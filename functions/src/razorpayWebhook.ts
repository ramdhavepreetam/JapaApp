import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Server-side source of truth for subscription prices (in paise), so a client
// can never request an order for less than the real plan price. Must be kept
// in sync with the `plans` array in src/components/SubscribeModal.tsx.
const SUBSCRIPTION_PLAN_PRICES_PAISE: Record<string, number> = {
  pro: 19900, // ₹199/mo
  community: 99900, // ₹999/mo
};

// Free-form donations (isSubscription=false) have no fixed price, but we still
// cap them to guard against fat-fingered or malicious absurd amounts.
const MAX_DONATION_AMOUNT_PAISE = 500000 * 100; // ₹5,00,000

const getRazorpayCredentials = () => {
  const keyId = process.env.VITE_RAZORPAY_KEY_ID || functions.config().razorpay?.key_id;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || functions.config().razorpay?.key_secret;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are not configured (RAZORPAY key_id/key_secret missing).');
  }

  return { keyId, keySecret };
};

const getRazorpayInstance = () => {
  const { keyId, keySecret } = getRazorpayCredentials();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

export const createRazorpayOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const { amount, isSubscription, planId } = data;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid amount is required.');
  }

  // Server-side price validation: the client cannot dictate its own subscription price.
  if (isSubscription) {
    if (typeof planId !== 'string' || !(planId in SUBSCRIPTION_PLAN_PRICES_PAISE)) {
      throw new functions.https.HttpsError('invalid-argument', 'Unknown subscription plan.');
    }
    const expectedAmount = SUBSCRIPTION_PLAN_PRICES_PAISE[planId];
    if (amount !== expectedAmount) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Amount does not match the price for plan "${planId}".`
      );
    }
  } else if (amount > MAX_DONATION_AMOUNT_PAISE) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount exceeds the maximum allowed donation.');
  }

  try {
    const razorpay = getRazorpayInstance();
    const options = {
      amount: amount, // amount in the smallest currency unit (paise)
      currency: 'INR',
      receipt: `receipt_${context.auth.uid}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    // Store pending order context to verify later if needed
    await db.collection('donations_pending').doc(order.id).set({
      userId: context.auth.uid,
      amount: amount / 100,
      isSubscription: isSubscription || false,
      planId: planId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      id: order.id,
      currency: order.currency,
      amount: order.amount
    };
  } catch (error: any) {
    console.error('Error creating Razorpay order:', { message: error?.message, uid: context.auth.uid });
    throw new functions.https.HttpsError('internal', 'Unable to create order.');
  }
});

export const razorpayWebhook = functions.https.onRequest(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || functions.config().razorpay?.webhook_secret;
  const signature = req.headers['x-razorpay-signature'] as string;

  if (!secret) {
    console.error('Webhook Error: RAZORPAY_WEBHOOK_SECRET is not configured.');
    res.status(500).send('Webhook not configured');
    return;
  }

  if (!signature) {
    res.status(400).send('Missing signature');
    return;
  }

  try {
    // Verify against the exact raw bytes Razorpay signed — re-serializing the
    // parsed req.body via JSON.stringify can byte-mismatch the original
    // (key order, whitespace, numeric formatting), causing valid deliveries
    // to be wrongly rejected. `rawBody` is populated by the Functions runtime.
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      res.status(400).send('Invalid signature');
      return;
    }

    const event = req.body.event;

    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = req.body.payload.payment.entity;
      const orderId = payment.order_id;

      const donationRef = db.collection('donations').doc(payment.id);

      // Idempotency guard: Razorpay retries webhook deliveries on any non-2xx
      // response, and may also deliver the same event more than once. Without
      // this check, a retried delivery would re-run the plan-upgrade below and
      // silently extend a user's subscription by another 30 days from
      // wall-clock "now" each time, even though only one payment was made.
      const existingDonation = await donationRef.get();
      if (existingDonation.exists && existingDonation.data()?.status === 'successful') {
        res.status(200).send('OK (already processed)');
        return;
      }

      // Retrieve pending order to know which user this belongs to
      const pendingRef = db.collection('donations_pending').doc(orderId);
      const pendingSnap = await pendingRef.get();

      let userId = 'unknown';
      let isSubscription = false;
      let planId = null;

      if (pendingSnap.exists) {
        const pendingData = pendingSnap.data()!;
        userId = pendingData.userId;
        isSubscription = pendingData.isSubscription;
        planId = pendingData.planId;
      }

      if (userId === 'unknown') {
        console.error('Webhook Error: no matching donations_pending doc for order', { orderId, paymentId: payment.id });
      }

      await donationRef.set({
        userId,
        amount: payment.amount / 100, // standard INR
        status: 'successful',
        razorpayOrderId: orderId,
        razorpayPaymentId: payment.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (isSubscription && planId && userId !== 'unknown') {
        const planMap: Record<string, 'Free' | 'Pro' | 'Community'> = {
          'pro': 'Pro',
          'community': 'Community'
        };

        const planName = planMap[planId];
        if (planName) {
          // Add 30 days to current logic
          const mapDays = 30 * 24 * 60 * 60 * 1000;
          const planExpiresAt = new Date(Date.now() + mapDays);

          await db.collection('users').doc(userId).set({
            plan: planName,
            planExpiresAt: admin.firestore.Timestamp.fromDate(planExpiresAt)
          }, { merge: true });
        }
      }
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Webhook Error:', { message: error?.message, event: req.body?.event });
    res.status(500).send('Internal Server Error');
  }
});
