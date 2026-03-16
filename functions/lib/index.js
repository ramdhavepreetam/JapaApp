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
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayWebhook = exports.createRazorpayOrder = exports.onUserCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Triggered when a new Firebase Auth user is created.
 * Creates the Firestore user profile document server-side,
 * preventing race conditions and unauthorized writes from the client.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    const db = admin.firestore();
    const userRef = db.doc(`users/${user.uid}`);
    const snap = await userRef.get();
    if (snap.exists)
        return; // Already created (e.g. by a concurrent client call)
    await userRef.set({
        uid: user.uid,
        displayName: user.displayName || 'Devotee',
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        stats: {
            totalMalas: 0,
            totalMantras: 0,
            streakDays: 0,
            lastChantDate: null,
        }
    });
});
// Re-export existing payment functions
var razorpayWebhook_1 = require("./razorpayWebhook");
Object.defineProperty(exports, "createRazorpayOrder", { enumerable: true, get: function () { return razorpayWebhook_1.createRazorpayOrder; } });
Object.defineProperty(exports, "razorpayWebhook", { enumerable: true, get: function () { return razorpayWebhook_1.razorpayWebhook; } });
//# sourceMappingURL=index.js.map