import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PlayerStats, ColumnDef } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Info, Filter, Sparkles, Loader2, Key, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateStyleEvaluations, getStoredApiKey, storeApiKey } from "@/lib/ai-evaluator";
import { saveEvaluations, loadEvaluations } from "@/lib/firebase";
import { toast } from "sonner";

interface ScoreboardTableProps {
    data: PlayerStats[];
    title: string;
    scope: string;
    userId?: string;
}

const COLUMNS: readonly ColumnDef[] = [
    { id: 'name', label: '玩家' },
    { id: 'score', label: '综合评分', tooltip: '基于六维数据的加权评分 (50-99)。权重模型：夏普比率: 25%, 盈亏比: 20%, 平均盈亏: 15%, 胜率: 15%, 最大回撤: 15%, 总场次: 10%' },
    { id: 'totalPnL', label: '总盈亏' },
    { id: 'avgPnL', label: '平均盈亏' },
    { id: 'winRate', label: '胜率' },
    { id: 'profitFactor', label: '盈亏比', tooltip: '盈亏比 = 总盈利 / |总亏损|。衡量盈利效率。 >1.0 为盈利，>1.5 优秀。' },
    { id: 'volatility', label: '波动率', tooltip: '历史盈亏的标准差。衡量资金曲线的波动程度。数值越低代表发挥越稳健。' },
    { id: 'sharpe', label: 'SHARPE', tooltip: '夏普比率 = 平均盈亏 / 波动率。衡量风险调整后的收益。代表玩家的技术含金量。' },
    { id: 'maxDrawdown', label: '最大回撤', tooltip: '资金曲线从最高点下跌的最大幅度。衡量抗风险能力和最大潜在损失。' },
    { id: 'maxLosingStreak', label: '连亏' },
    { id: 'totalSessions', label: '局数' }
] as const;

export function ScoreboardTable({ data, title, scope, userId }: ScoreboardTableProps) {
    const [minSessions, setMinSessions] = useState(0);
    const [sortConfig, setSortConfig] = useState<{ key: keyof PlayerStats; direction: 'asc' | 'desc' }>({
        key: 'score',
        direction: 'desc'
    });

    // AI evaluation state
    const [apiKey, setApiKey] = useState(getStoredApiKey);
    const [showApiKey, setShowApiKey] = useState(false);
    const [evaluations, setEvaluations] = useState<Record<string, string>>({});
    const [generating, setGenerating] = useState(false);
    const [showAiPanel, setShowAiPanel] = useState(false);

    // Load saved evaluations from Firestore on mount
    useEffect(() => {
        if (scope === 'shared') return;
        loadEvaluations(scope, userId).then(saved => {
            if (Object.keys(saved).length > 0) setEvaluations(saved);
        }).catch(() => { /* ignore load errors */ });
    }, [scope, userId]);

    const handleSort = (key: keyof PlayerStats) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleGenerate = async () => {
        if (!apiKey.trim()) return toast.error("请先输入 Gemini API Key");
        if (filteredData.length === 0) return toast.error("暂无玩家数据");

        storeApiKey(apiKey);
        setGenerating(true);
        try {
            const result = await generateStyleEvaluations(apiKey.trim(), filteredData);
            setEvaluations(result);
            // Save to Firestore for persistence
            if (userId && scope !== 'shared') {
                await saveEvaluations(scope, userId, result);
            }
            toast.success("风格评价已生成 ✨");
        } catch (e: any) {
            const msg = e.message || "生成失败";
            if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
                toast.error("API Key 无效或无权限，请检查");
            } else if (msg.includes("429") || msg.includes("Resource exhausted") || msg.includes("速率限制")) {
                toast.error("API 调用频率超限，请等待 1 分钟后重试");
            } else {
                toast.error("生成失败: " + msg);
            }
        } finally {
            setGenerating(false);
        }
    };

    const filteredData = data.filter(s => s.totalSessions >= minSessions);

    const sortedData = [...filteredData].sort((a, b) => {
        const aVal = a[sortConfig.key] ?? 0;
        const bVal = b[sortConfig.key] ?? 0;
        if (aVal === bVal) return 0;
        const modifier = sortConfig.direction === 'asc' ? 1 : -1;
        return aVal > bVal ? modifier : -modifier;
    });

    const getScoreColor = (score: number) => {
        if (score >= 80) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-bold";
        if (score >= 60) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold";
        if (score < 40) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
        return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold">{title}</h2>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Filter className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">最小局数</span>
                        <Input
                            type="number"
                            min={0}
                            value={minSessions || ''}
                            onChange={(e) => setMinSessions(parseInt(e.target.value) || 0)}
                            className="w-16 h-7 text-xs text-center"
                            placeholder="0"
                        />
                    </div>
                    {scope !== 'shared' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => setShowAiPanel(!showAiPanel)}
                        >
                            <Sparkles className="w-3 h-3" />
                            AI 评价
                        </Button>
                    )}
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-semibold",
                        scope === 'public' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    )}>
                        {scope === 'public' ? '公共' : scope === 'private' ? '私人' : '共享'}
                    </span>
                </div>
            </div>

            {/* Collapsible AI Panel */}
            {showAiPanel && scope !== 'shared' && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-2">
                    <div className="relative flex-1">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            type={showApiKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="输入 Gemini API Key"
                            className="pl-9 pr-9 h-8 text-xs font-mono"
                        />
                        <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleGenerate}
                        disabled={generating || filteredData.length === 0}
                        className="h-8 gap-1.5 whitespace-nowrap"
                    >
                        {generating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {generating ? '生成中...' : '生成风格评价'}
                    </Button>
                </div>
            )}

            <div className="rounded-xl border shadow-sm overflow-hidden bg-white dark:bg-card">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            {COLUMNS.map((col) => (
                                <TableHead
                                    key={col.id}
                                    className={cn(
                                        "cursor-pointer hover:bg-muted transition-colors whitespace-nowrap",
                                        col.id !== 'name' && "text-right"
                                    )}
                                    onClick={() => handleSort(col.id as keyof PlayerStats)}
                                >
                                    <div className={cn("flex items-center gap-1", col.id !== 'name' && "justify-end")}>
                                        {col.label}
                                        {col.tooltip && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger className="cursor-pointer">
                                                        <Info className="h-3 w-3 opacity-50" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-[200px]">
                                                        {col.tooltip}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        {sortConfig.key === col.id && (
                                            <span className="text-[10px] ml-1 opacity-70">
                                                {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={COLUMNS.length} className="h-24 text-center text-muted-foreground italic">
                                    暂无数据...
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedData.map((s, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/30">
                                    <TableCell className="font-semibold">{s.name}</TableCell>
                                    <TableCell className="text-right">
                                        {evaluations[s.name] ? (
                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded-full text-xs cursor-help border-b border-dashed border-amber-400/50",
                                                            getScoreColor(s.score || 0)
                                                        )}>
                                                            {Math.round(s.score || 0)} ✨
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side="right"
                                                        align="start"
                                                        className="max-w-[320px] px-4 py-3 text-sm leading-relaxed whitespace-pre-line bg-popover text-popover-foreground border shadow-lg"
                                                    >
                                                        {evaluations[s.name]}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <span className={cn("px-2 py-0.5 rounded-full text-xs", getScoreColor(s.score || 0))}>
                                                {Math.round(s.score || 0)}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        <span className={cn(
                                            "px-1.5 py-0.5 rounded",
                                            (s.totalPnL || 0) > 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-bold" :
                                                (s.totalPnL || 0) < 0 ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 font-bold" : "text-muted-foreground"
                                        )}>
                                            {(s.totalPnL || 0).toFixed(0)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs opacity-80">{(s.avgPnL || 0).toFixed(0)}</TableCell>
                                    <TableCell className="text-right font-mono text-xs opacity-80">{(s.winRate || 0).toFixed(0)}%</TableCell>
                                    <TableCell className="text-right font-mono text-xs opacity-80">{s.profitFactor === Infinity ? '∞' : (s.profitFactor || 0).toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-mono text-xs opacity-80">{(s.volatility || 0).toFixed(0)}</TableCell>
                                    <TableCell className="text-right font-mono text-xs opacity-80">{(s.sharpe || 0).toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-mono text-xs opacity-80">{(s.maxDrawdown || 0).toFixed(0)}</TableCell>
                                    <TableCell className="text-right font-mono text-xs opacity-80">{s.maxLosingStreak}</TableCell>
                                    <TableCell className="text-right font-mono text-xs opacity-80">{s.totalSessions}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
