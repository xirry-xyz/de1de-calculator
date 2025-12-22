import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSessions, useScoreboard } from "@/hooks/use-firebase-data";
import { SessionConfigForm } from "@/components/game-calculator/session-config";
import { ResultsTable } from "@/components/game-calculator/results-table";
import { TransferList } from "@/components/game-calculator/transfer-list";
import { ScoreboardTable } from "@/components/leaderboards/scoreboard-table";
import { SessionHistory } from "@/components/history/session-history";
import type { SessionConfig, PlayerResult, Session } from "@/lib/types";
import { adjustDiscrepancy, calculateTransfers } from "@/lib/calculator-logic";
import { Button } from "@/components/ui/button";
import { Sun, Moon, LogIn, LogOut, Loader2 } from "lucide-react";
import { db, PROJECT_ID } from "@/lib/firebase";
import { doc, setDoc, runTransaction } from "firebase/firestore";
import { Toaster, toast } from "sonner";

export default function App() {
    const { user, loading: authLoading, isAdmin, signIn, logout } = useAuth();
    const [theme, setTheme] = useState<'light' | 'dark'>(
        (localStorage.getItem('theme') as 'light' | 'dark') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    );

    const [sessionPlayers, setSessionPlayers] = useState<PlayerResult[]>([]);
    const [config, setConfig] = useState<SessionConfig>({ chipsPerEntry: 3000, cnyPerEntry: 300 });
    const [sessionName, setSessionName] = useState("");
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
    const [transfers, setTransfers] = useState<{ from: string; to: string; amount: number }[]>([]);
    const [showTransfers, setShowTransfers] = useState(false);

    const { sessions: publicSessions } = useSessions(user?.uid, true);
    const { sessions: privateSessions } = useSessions(user?.uid, false);
    const { stats: publicStats } = useScoreboard(user?.uid, true);
    const { stats: privateStats } = useScoreboard(user?.uid, false);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    const onAddPlayer = (player: PlayerResult) => {
        const existingIndex = sessionPlayers.findIndex(p => p.name === player.name);
        let newList: PlayerResult[];
        if (existingIndex !== -1) {
            newList = [...sessionPlayers];
            newList[existingIndex] = player;
        } else {
            newList = [...sessionPlayers, player];
        }
        setSessionPlayers(adjustDiscrepancy(newList));
        setShowTransfers(false);
    };

    const removePlayer = (id: number) => {
        setSessionPlayers(adjustDiscrepancy(sessionPlayers.filter(p => p.id !== id)));
        setShowTransfers(false);
    };

    const clearSession = () => {
        setSessionPlayers([]);
        setShowTransfers(false);
    };

    const onCalculateTransfers = () => {
        if (sessionPlayers.length === 0) return;
        const txs = calculateTransfers(sessionPlayers.map(p => ({
            name: p.name,
            pnl: p.adjustedPnLCNY
        })));
        setTransfers(txs);
        setShowTransfers(true);
    };

    const saveSession = async () => {
        if (!user || user.isAnonymous) return toast.error("请先登录");
        if (sessionPlayers.length === 0) return toast.error("暂无玩家数据");

        const sid = Date.now().toString();
        const dateStr = new Date(sessionDate + 'T00:00:00').toISOString();

        // Path resolution
        const sessionPath = isAdmin
            ? `artifacts/${PROJECT_ID}/public/data/sessions`
            : `artifacts/${PROJECT_ID}/users/${user.uid}/private-sessions`;

        const scoreboardPath = isAdmin
            ? `artifacts/${PROJECT_ID}/public/data/scoreboard`
            : `artifacts/${PROJECT_ID}/users/${user.uid}/private-scoreboard`;

        try {
            await setDoc(doc(db, sessionPath, sid), {
                id: sid,
                date: dateStr,
                name: sessionName || '未命名牌局',
                config,
                playerResults: sessionPlayers.map(p => ({ name: p.name, pnlCNY: p.adjustedPnLCNY }))
            });

            await runTransaction(db, async (t) => {
                for (const p of sessionPlayers) {
                    const ref = doc(db, scoreboardPath, p.name);
                    const snap = await t.get(ref);
                    let history = snap.exists() ? (snap.data().history || []) : [];
                    history = history.filter((h: any) => h.sessionId !== sid);
                    history.push({ sessionId: sid, date: dateStr, pnl: p.adjustedPnLCNY });
                    t.set(ref, { name: p.name, history }, { merge: true });
                }
            });

            toast.success("牌局数据已保存");
            clearSession();
            setSessionName("");
        } catch (e: any) {
            toast.error("保存失败: " + e.message);
        }
    };

    const deleteSession = async (session: Session) => {
        if (!window.confirm("确认要删除这条记录吗？这也会撤销相关的积分统计。")) return;

        const isPublic = isAdmin; // Only admin can delete public sessions from UI
        const sessionPath = isPublic
            ? `artifacts/${PROJECT_ID}/public/data/sessions`
            : `artifacts/${PROJECT_ID}/users/${user?.uid}/private-sessions`;

        const scoreboardPath = isPublic
            ? `artifacts/${PROJECT_ID}/public/data/scoreboard`
            : `artifacts/${PROJECT_ID}/users/${user?.uid}/private-scoreboard`;

        try {
            await runTransaction(db, async (t) => {
                t.delete(doc(db, sessionPath, session.id));
                for (const r of session.playerResults) {
                    const ref = doc(db, scoreboardPath, r.name);
                    const snap = await t.get(ref);
                    if (snap.exists()) {
                        const history = snap.data().history.filter((h: any) => h.sessionId !== session.id);
                        t.set(ref, { history }, { merge: true });
                    }
                }
            });
            toast.success("记录已删除");
        } catch (e: any) {
            toast.error("删除失败: " + e.message);
        }
    };

    const historicalPlayers = Array.from(new Set([
        ...publicStats.map(s => s.name),
        ...privateStats.map(s => s.name)
    ])).slice(0, 15);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background transition-colors duration-300 antialiased font-sans">
            <Toaster position="top-center" />

            <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-10">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black tracking-tight flex items-baseline gap-3">
                            de1de tracker
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted border border-border">v3.0.0</span>
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium italic opacity-70">Never give up. Never.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full">
                            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                        </Button>

                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-bold">{user ? (user.isAnonymous ? '访客' : user.email) : '未登录'}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                {isAdmin ? 'ADMINISTRATOR' : (user && !user.isAnonymous ? 'AUTH USER' : 'READ-ONLY')}
                            </p>
                        </div>

                        {user ? (
                            <Button variant="secondary" onClick={logout} className="rounded-xl shadow-sm">
                                <LogOut className="w-4 h-4 mr-2" /> 退出
                            </Button>
                        ) : (
                            <Button onClick={signIn} className="rounded-xl shadow-sm font-bold bg-primary hover:bg-primary/90">
                                <LogIn className="w-4 h-4 mr-2" /> Google 登录
                            </Button>
                        )}
                    </div>
                </header>

                {/* Main Content */}
                <main className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                    {/* Input and Live Table */}
                    <div className="space-y-8">
                        <SessionConfigForm
                            config={config}
                            setConfig={setConfig}
                            sessionName={sessionName}
                            setSessionName={setSessionName}
                            sessionDate={sessionDate}
                            setSessionDate={setSessionDate}
                            onAddPlayer={onAddPlayer}
                            historicalPlayers={historicalPlayers}
                            disabled={!user || user.isAnonymous}
                        />

                        <div className="space-y-4">
                            <ResultsTable
                                players={sessionPlayers}
                                onRemovePlayer={removePlayer}
                                onClear={clearSession}
                                onSave={saveSession}
                                onCalculateTransfers={onCalculateTransfers}
                                disabled={!user || user.isAnonymous}
                            />
                            <TransferList transfers={transfers} visible={showTransfers} />
                        </div>
                    </div>

                    {/* Lists and History */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <SessionHistory
                            sessions={publicSessions}
                            title="历史牌局"
                            scope="public"
                            onRefresh={() => { }}
                            onDelete={isAdmin ? deleteSession : undefined}
                        />
                        <SessionHistory
                            sessions={privateSessions}
                            title="我的记录"
                            scope="private"
                            onRefresh={() => { }}
                            onDelete={user && !user.isAnonymous ? deleteSession : undefined}
                        />
                    </div>

                    {/* Scoreboards */}
                    <div className="space-y-12 pt-4">
                        <ScoreboardTable
                            data={publicStats}
                            title="总积分榜"
                            scope="public"
                        />
                        <ScoreboardTable
                            data={privateStats}
                            title="私人积分榜"
                            scope="private"
                        />
                    </div>
                </main>

                <footer className="pt-20 pb-10 text-center border-t border-muted/30">
                    <p className="text-xs text-muted-foreground opacity-50">Powered by React + shadcn/ui • 2025</p>
                </footer>
            </div>
        </div>
    );
}