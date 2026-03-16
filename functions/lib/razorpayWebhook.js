"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayWebhook = exports.createRazorpayOrder = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const razorpay_1 = __importDefault(require("razorpay"));
const crypto = __importStar(require("crypto"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// Initialize Razorpay
// Note: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in Firebase Functions config or env
const getRazorpayInstance = () => {
    var _a, _b;
    return new razorpay_1.default({
        key_id: process.env.VITE_RAZORPAY_KEY_ID || ((_a = functions.config().razorpay) === null || _a === void 0 ? void 0 : _a.key_id) || 'dummy_key',
        key_secret: process.env.RAZORPAY_KEY_SECRET || ((_b = functions.config().razorpay) === null || _b === void 0 ? void 0 : _b.key_secret) || 'dummy_secret',
    });
};
exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('Error creating Razorpay order:', error);
        throw new functions.https.HttpsError('internal', 'Unable to create order.');
    }
});
exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
    var _a;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || ((_a = functions.config().razorpay) === null || _a === void 0 ? void 0 : _a.webhook_secret) || 'dummy_webhook_secret';
    const signature = req.headers['x-razorpay-signature'];
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
                const pendingData = pendingSnap.data();
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
                const planMap = {
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
    }
    catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
//# sourceMappingURL=razorpayWebhook.js.map