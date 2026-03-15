import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Initialize Razorpay
// Note: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in Firebase Functions config or env
const getRazorpayInstance = () => {
  return new Razorpay({
    key_id: process.env.VITE_RAZORPAY_KEY_ID || functions.config().razorpay?.key_id || 'dummy_key',
    key_secret: process.env.RAZORPAY_KEY_SECRET || functions.config().razorpay?.key_secret || 'dummy_secret',
  });
};

export const createRazorpayOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const { amount, isSubscription, planId } = data;

  if (!amount || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid amount is required.');
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
    console.error('Error creating Razorpay order:', error);
    throw new functions.https.HttpsError('internal', 'Unable to create order.');
  }
});

export const razorpayWebhook = functions.https.onRequest(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || functions.config().razorpay?.webhook_secret || 'dummy_webhook_secret';
  const signature = req.headers['x-razorpay-signature'] as string;

  if (!signature) {
    res.status(400).send('Missing signature');
    return;
  }

  try {
    const bodyString = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyString)
      .digest('hex');

    if (expectedSignature !== signature) {
      res.status(400).send('Invalid signature');
      return;
    }

    const event = req.body.event;
    
    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = req.body.payload.payment.entity;
      const orderId = payment.order_id;

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

      await db.collection('donations').doc(payment.id).set({
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
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).send('Internal Server Error');
  }
});
