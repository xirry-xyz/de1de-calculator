import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, RefreshCcw, Lock, Globe } from "lucide-react";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SessionHistoryProps {
    sessions: Session[];
    title: string;
    scope: 'public' | 'private';
    onDelete?: (session: Session) => void;
    onRefresh?: () => void;
    loading?: boolean;
}

export function SessionHistory({ sessions, title, scope, onDelete, onRefresh, loading }: SessionHistoryProps) {
    return (
        <Card className="rounded-xl overflow-hidden shadow-sm h-[400px] flex flex-col">
            <CardHeader className="bg-muted/50 border-b py-4 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        {scope === 'public' ? <Globe className="w-4 h-4 text-amber-500" /> : <Lock className="w-4 h-4 text-blue-500" />}
                        {title}
                    </CardTitle>
                    <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest mt-1 inline-block",
                        scope === 'public' ? "text-amber-600" : "text-blue-600"
                    )}>
                        {scope === 'public' ? '公共记录' : '个人专享'}
                    </span>
                </div>
                <Button variant="ghost" size="icon" onClick={onRefresh} className="text-muted-foreground">
                    <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full bg-muted/10 p-4">
                    {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground opacity-50 space-y-2">
                            <span className="text-sm italic">{loading ? '同步中...' : '暂无记录'}</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sessions.map((s) => (
                                <div
                                    key={s.id}
                                    className="bg-white dark:bg-card border rounded-xl p-4 shadow-sm hover:border-primary/20 transition-all flex justify-between items-start"
                                >
                                    <div className="space-y-1">
                                        <div className="font-bold text-sm">
                                            {s.name || '未命名牌局'}
                                            <span className="ml-2 font-normal text-xs text-muted-foreground">
                                                {new Date(s.date).toLocaleDateString('zh-CN')}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {s.playerResults.map((p, idx) => (
                                                <span key={idx} className={cn(
                                                    "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                                                    p.pnlCNY > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" :
                                                        p.pnlCNY < 0 ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" :
                                                            "bg-muted text-muted-foreground border-transparent"
                                                )}>
                                                    {p.name}: {p.pnlCNY > 0 ? `+${Math.round(p.pnlCNY)}` : Math.round(p.pnlCNY)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    {onDelete && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onDelete(s)}
                                            className="text-muted-foreground hover:text-red-500"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
