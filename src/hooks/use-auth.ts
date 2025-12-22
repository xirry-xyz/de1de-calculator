import { useState, useEffect } from "react";
import { onAuthStateChanged, type User, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, ADMIN_EMAIL } from "@/lib/firebase";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setIsAdmin(u !== null && !u.isAnonymous && u.email === ADMIN_EMAIL);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const signIn = async () => {
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (error) {
            console.error("Login failed", error);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return { user, loading, isAdmin, signIn, logout };
}
