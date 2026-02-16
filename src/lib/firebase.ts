import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, getDocs, query, where, collection } from "firebase/firestore";
import type { SharedBoard } from "./types";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const ADMIN_EMAIL = 'xirry.xyz@gmail.com';
export const PROJECT_ID = firebaseConfig.projectId;

const ACCESS_CODES_PATH = `artifacts/${PROJECT_ID}/access-codes`;

export async function setAccessCode(uid: string, accessCode: string, displayName: string): Promise<void> {
    await setDoc(doc(db, ACCESS_CODES_PATH, uid), { uid, accessCode, displayName });
}

export async function lookupAccessCode(code: string): Promise<SharedBoard | null> {
    const q = query(collection(db, ACCESS_CODES_PATH), where("accessCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as SharedBoard;
}

// --- Style Evaluations Persistence ---
const EVALUATIONS_BASE = `artifacts/${PROJECT_ID}`;

function getEvaluationsPath(scope: string, userId?: string): string {
    if (scope === 'public') return `${EVALUATIONS_BASE}/evaluations/public-scoreboard`;
    return `${EVALUATIONS_BASE}/users/${userId}/evaluations/private-scoreboard`;
}

export async function saveEvaluations(
    scope: string,
    userId: string,
    evaluations: Record<string, string>
): Promise<void> {
    const path = getEvaluationsPath(scope, userId);
    await setDoc(doc(db, path), { evaluations, generatedAt: new Date().toISOString() });
}

export async function loadEvaluations(
    scope: string,
    userId?: string
): Promise<Record<string, string>> {
    if (!userId && scope !== 'public') return {};
    const path = getEvaluationsPath(scope, userId);
    const snap = await getDoc(doc(db, path));
    if (!snap.exists()) return {};
    return (snap.data().evaluations || {}) as Record<string, string>;
}
