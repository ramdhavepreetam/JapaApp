import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { donationService } from './donationService';
import { auth } from '../lib/firebase';
import * as functions from 'firebase/functions';

// Mock Firebase Auth
vi.mock('../lib/firebase', () => ({
  auth: { currentUser: null },
  app: {},
  db: {}
}));

// Mock Firebase Functions
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn()
}));

describe('donationService', () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    // Save original navigator state
    originalOnLine = navigator.onLine;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original navigator state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalOnLine
    });
    delete (window as any).Razorpay;
  });

  it('throws an error if offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    await expect(donationService.createOrder({ amount: 100 }))
      .rejects.toThrow('Offline: Payment flows require live connection.');
  });

  it('throws an error if use is not authenticated', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    // Auth is already mocked to null
    await expect(donationService.createOrder({ amount: 100 }))
      .rejects.toThrow('You must be logged in to complete this action.');
  });

  it('calls httpsCallable and opens Razorpay checkout on pass', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Mock authenticated user
    (auth as any).currentUser = { uid: 'user123', email: 'test@example.com', displayName: 'Test User' };

    // Mock httpsCallable response
    const mockHttpsCallable = vi.fn().mockResolvedValue({
      data: { id: 'order_123', amount: 10000, currency: 'INR' }
    });
    vi.spyOn(functions, 'httpsCallable').mockReturnValue(mockHttpsCallable as any);

    // Mock Razorpay client
    const mockRazorpayOpen = vi.fn();
    const mockRazorpayOn = vi.fn();
    const mockRazorpayConstructor = vi.fn().mockImplementation(() => ({
      open: mockRazorpayOpen,
      on: mockRazorpayOn
    }));
    (window as any).Razorpay = mockRazorpayConstructor;

    await donationService.createOrder({ amount: 100 });

    expect(mockHttpsCallable).toHaveBeenCalledWith({
      amount: 100,
      isSubscription: undefined,
      planId: undefined
    });
    expect(mockRazorpayConstructor).toHaveBeenCalled();
    expect(mockRazorpayOpen).toHaveBeenCalled();

    // Reset auth for other tests
    (auth as any).currentUser = null;
  });
});
