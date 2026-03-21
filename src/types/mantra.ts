import { Timestamp } from 'firebase/firestore';

export interface Mantra {
    id: string;
    name: string;             // "Om Namah Shivaya"
    nameDevanagari: string;   // "ॐ नमः शिवाय" (Hindi / Sanskrit in Devanagari)
    nameMarathi?: string;     // "णमो अरिहंताणं" (Marathi / Prakrit in Devanagari)
    tradition: string;        // "Shaiva" | "Vaishnava" | "Vedic" | "Buddhist" | "Jain"
    audioUrl: string;         // Cloudflare R2 CDN URL
    position: number;         // display order (ascending)
    addedBy?: string;
    addedAt?: Timestamp;
}
