import { Timestamp } from 'firebase/firestore';

export type SubscriptionPlanTier = 'Free' | 'Pro' | 'Community';

export interface Donation {
  id: string;
  userId: string;
  amount: number; // in INR
  status: 'created' | 'successful' | 'failed';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  message?: string;
}

export interface UserSubscription {
  plan: SubscriptionPlanTier;
  planExpiresAt: Timestamp | null;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
}
