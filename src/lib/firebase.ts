import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, getDocs, query, where, collection } from "firebase/firestore";
import type { SharedBoard } from "./types";

const firebaseConfig = {
    apiKey: "***REMOVED***",
    authDomain: "de1de-calculator.firebaseapp.com",
    projectId: "de1de-calculator",
    storageBucket: "de1de-calculator.firebasestorage.app",
    messagingSenderId: "1076456073032",
    appId: "1:1076456073032:web:5402bb2cb74e6940bf757d"
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
