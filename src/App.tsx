import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSessions, useScoreboard, useSharedScoreboard } from "@/hooks/use-firebase-data";
import { SessionConfigForm } from "@/components/game-calculator/session-config";
import { ResultsTable } from "@/components/game-calculator/results-table";
import { TransferList } from "@/components/game-calculator/transfer-list";
import { ScoreboardTable } from "@/components/leaderboards/scoreboard-table";
import { SessionHistory } from "@/components/history/session-history";
import type { SessionConfig, PlayerResult, Session, SharedBoard } from "@/lib/types";
import { adjustDiscrepancy, calculateTransfers } from "@/lib/calculator-logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun, Moon, LogIn, LogOut, Loader2, Key, Search, X, Share2 } from "lucide-react";
import { db, PROJECT_ID, setAccessCode, lookupAccessCode } from "@/lib/firebase";
import { doc, setDoc, runTransaction, getDoc } from "firebase/firestore";
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

    // Access code state
    const [myAccessCode, setMyAccessCode] = useState("");
    const [myAccessCodeSaved, setMyAccessCodeSaved] = useState("");
    const [lookupCode, setLookupCode] = useState("");
    const [sharedBoard, setSharedBoard] = useState<SharedBoard | null>(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const { stats: sharedStats } = useSharedScoreboard(sharedBoard?.uid ?? null);

    // Load existing access code on login
    useEffect(() => {
        if (!user || user.isAnonymous) return;
        const loadCode = async () => {
            try {
                const snap = await getDoc(doc(db, `artifacts/${PROJECT_ID}/access-codes`, user.uid));
                if (snap.exists()) {
                    const data = snap.data();
                    setMyAccessCode(data.accessCode || "");
                    setMyAccessCodeSaved(data.accessCode || "");
                }
            } catch { /* ignore */ }
        };
        loadCode();
    }, [user]);

    const handleSetAccessCode = async () => {
        if (!user || user.isAnonymous) return;
        if (!myAccessCode.trim()) return toast.error("请输入 access code");
        try {
            await setAccessCode(user.uid, myAccessCode.trim(), user.displayName || user.email || '匿名用户');
            setMyAccessCodeSaved(myAccessCode.trim());
            toast.success("Access code 已保存");
        } catch (e: any) {
            toast.error("保存失败: " + e.message);
        }
    };

    const handleLookup = async () => {
        if (!lookupCode.trim()) return;
        setLookupLoading(true);
        try {
            const result = await lookupAccessCode(lookupCode.trim());
            if (result) {
                setSharedBoard(result);
                toast.success(`已连接到 ${result.displayName} 的榜单`);
            } else {
                toast.error("未找到对应榜单");
            }
        } catch (e: any) {
            toast.error("查询失败: " + e.message);
        } finally {
            setLookupLoading(false);
        }
    };

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
                const results = [];
                for (const p of sessionPlayers) {
                    const ref = doc(db, scoreboardPath, p.name);
                    const snap = await t.get(ref);
                    results.push({ p, ref, snap });
                }

                for (const { p, ref, snap } of results) {
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
                const results = [];
                for (const r of session.playerResults) {
                    const ref = doc(db, scoreboardPath, r.name);
                    const snap = await t.get(ref);
                    results.push({ r, ref, snap });
                }

                t.delete(doc(db, sessionPath, session.id));
                for (const { ref, snap } of results) {
                    if (snap.exists()) {
                        const history = (snap.data().history || []).filter((h: any) => h.sessionId !== session.id);
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

                        {/* Access Code Section */}
                        <Card className="rounded-xl overflow-hidden shadow-sm">
                            <CardHeader className="bg-muted/50 border-b py-5 px-6">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Share2 className="w-5 h-5 text-primary" />
                                    榜单分享
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-6 pt-6 pb-8 space-y-6">
                                {/* Set my access code */}
                                {user && !user.isAnonymous && (
                                    <div className="space-y-3">
                                        <p className="text-sm font-medium text-muted-foreground">设置你的 Access Code，让朋友查看你的私人积分榜</p>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <Input
                                                    value={myAccessCode}
                                                    onChange={(e) => setMyAccessCode(e.target.value)}
                                                    placeholder="输入你的 access code"
                                                    className="pl-9"
                                                />
                                            </div>
                                            <Button onClick={handleSetAccessCode} disabled={!myAccessCode.trim() || myAccessCode.trim() === myAccessCodeSaved}>
                                                保存
                                            </Button>
                                        </div>
                                        {myAccessCodeSaved && (
                                            <p className="text-xs text-muted-foreground">
                                                当前 code: <span className="font-mono font-bold text-foreground">{myAccessCodeSaved}</span>
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Lookup someone's board */}
                                <div className="space-y-3 border-t pt-6">
                                    <p className="text-sm font-medium text-muted-foreground">输入朋友的 Access Code 查看其私人积分榜</p>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                value={lookupCode}
                                                onChange={(e) => setLookupCode(e.target.value)}
                                                placeholder="输入 access code"
                                                className="pl-9"
                                                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                                            />
                                        </div>
                                        <Button onClick={handleLookup} disabled={lookupLoading || !lookupCode.trim()}>
                                            {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '查看'}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Shared Scoreboard */}
                        {sharedBoard && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-2">
                                    <div />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setSharedBoard(null); setLookupCode(""); }}
                                        className="text-muted-foreground hover:text-red-500"
                                    >
                                        <X className="w-4 h-4 mr-1" /> 关闭
                                    </Button>
                                </div>
                                <ScoreboardTable
                                    data={sharedStats}
                                    title={`${sharedBoard.displayName} 的积分榜`}
                                    scope="shared"
                                />
                            </div>
                        )}
                    </div>
                </main>

                <footer className="pt-20 pb-10 text-center border-t border-muted/30">
                    <p className="text-xs text-muted-foreground opacity-50">Powered by React + shadcn/ui • 2025</p>
                </footer>
            </div>
        </div>
    );
}