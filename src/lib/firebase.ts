import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
