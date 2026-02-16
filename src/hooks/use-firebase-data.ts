import { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db, PROJECT_ID } from "@/lib/firebase";
import type { Session, PlayerStats, HistoryEntry } from "@/lib/types";
import { calculateMetrics, calculateCompositeScores } from "@/lib/calculator-logic";

export function useSessions(userId: string | undefined, isPublic: boolean) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) return;
        if (!isPublic && (!userId || userId === "anonymous")) {
            setSessions([]);
            setLoading(false);
            return;
        }

        const path = isPublic
            ? `artifacts/${PROJECT_ID}/public/data/sessions`
            : `artifacts/${PROJECT_ID}/users/${userId}/private-sessions`;

        const q = query(collection(db, path));

        const unsubscribe = onSnapshot(q, (snap) => {
            const list: Session[] = [];
            snap.forEach(d => list.push(d.data() as Session));
            list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setSessions(list);
            setLoading(false);
        });

        return unsubscribe;
    }, [userId, isPublic]);

    return { sessions, loading };
}

export function useScoreboard(userId: string | undefined, isPublic: boolean) {
    const [stats, setStats] = useState<PlayerStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) return;
        if (!isPublic && (!userId || userId === "anonymous")) {
            setStats([]);
            setLoading(false);
            return;
        }

        const path = isPublic
            ? `artifacts/${PROJECT_ID}/public/data/scoreboard`
            : `artifacts/${PROJECT_ID}/users/${userId}/private-scoreboard`;

        const unsubscribe = onSnapshot(collection(db, path), (snap) => {
            const hist: (HistoryEntry & { name: string })[] = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.history) {
                    data.history.forEach((h: HistoryEntry) => hist.push({ name: data.name, ...h }));
                }
            });

            const grp = hist.reduce((a, i) => {
                if (!a[i.name]) a[i.name] = [];
                a[i.name].push(i);
                return a;
            }, {} as Record<string, HistoryEntry[]>);

            let playerStats = Object.keys(grp).map(k => calculateMetrics(k, grp[k]));
            playerStats = calculateCompositeScores(playerStats);
            setStats(playerStats);
            setLoading(false);
        });

        return unsubscribe;
    }, [userId, isPublic]);

    return { stats, loading };
}

export function useSharedScoreboard(targetUid: string | null) {
    const [stats, setStats] = useState<PlayerStats[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!targetUid) {
            setStats([]);
            return;
        }

        setLoading(true);
        const path = `artifacts/${PROJECT_ID}/users/${targetUid}/private-scoreboard`;

        const unsubscribe = onSnapshot(collection(db, path), (snap) => {
            const hist: (HistoryEntry & { name: string })[] = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.history) {
                    data.history.forEach((h: HistoryEntry) => hist.push({ name: data.name, ...h }));
                }
            });

            const grp = hist.reduce((a, i) => {
                if (!a[i.name]) a[i.name] = [];
                a[i.name].push(i);
                return a;
            }, {} as Record<string, HistoryEntry[]>);

            let playerStats = Object.keys(grp).map(k => calculateMetrics(k, grp[k]));
            playerStats = calculateCompositeScores(playerStats);
            setStats(playerStats);
            setLoading(false);
        });

        return unsubscribe;
    }, [targetUid]);

    return { stats, loading };
}
