import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../lib/firebase';

const functions = getFunctions(app);

export interface CheckoutOptions {
  amount: number; // in INR
  isSubscription?: boolean;
  planId?: string; // Optional for subscriptions
  onSuccess?: (response: any) => void;
  onError?: (error: any) => void;
}

export const donationService = {
  createOrder: async (options: CheckoutOptions): Promise<void> => {
    if (!navigator.onLine) {
      throw new Error('Offline: Payment flows require live connection.');
    }

    if (!auth.currentUser) {
      throw new Error('You must be logged in to complete this action.');
    }

    try {
      // 1. Call Cloud Function to create Razorpay Order
      const createRazorpayOrder = httpsCallable(functions, 'createRazorpayOrder');
      const { data } = await createRazorpayOrder({ 
        amount: options.amount,
        isSubscription: options.isSubscription,
        planId: options.planId
      });

      const orderData = data as any;

      if (!orderData || !orderData.id) {
        throw new Error('Invalid order response from server');
      }

      // 2. Open Razorpay Checkout via Client SDK
      const rzpOptions = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || '', // Enter the Key ID generated from the Dashboard
        amount: orderData.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
        currency: orderData.currency,
        name: 'JapaApp',
        description: options.isSubscription ? 'Subscription Upgrade' : 'Spiritual Contribution',
        order_id: orderData.id, //This is a sample Order ID. Pass the `id` obtained in the response of Step 1
        handler: function (response: any) {
          // Razorpay returns razorpay_payment_id, razorpay_order_id, razorpay_signature
          if (options.onSuccess) {
            options.onSuccess(response);
          }
        },
        prefill: {
          name: auth.currentUser.displayName || '',
          email: auth.currentUser.email || '',
        },
        theme: {
          color: '#F59E0B' // Saffron color
        }
      };

      const rzp = new (window as any).Razorpay(rzpOptions);
      rzp.on('payment.failed', function (response: any) {
        if (options.onError) {
          options.onError(response.error);
        }
      });
      rzp.open();

    } catch (error) {
      console.error('Donation Service Error:', error);
      if (options.onError) options.onError(error);
      throw error;
    }
  }
};
