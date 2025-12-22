import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { PlayerResult, SessionConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SessionConfigProps {
    config: SessionConfig;
    setConfig: (config: SessionConfig) => void;
    sessionName: string;
    setSessionName: (name: string) => void;
    sessionDate: string;
    setSessionDate: (date: string) => void;
    onAddPlayer: (player: PlayerResult) => void;
    historicalPlayers: string[];
    disabled?: boolean;
}

export function SessionConfigForm({
    config, setConfig, sessionName, setSessionName, sessionDate, setSessionDate,
    onAddPlayer, historicalPlayers, disabled
}: SessionConfigProps) {
    const [playerName, setPlayerName] = useState("");
    const [entries, setEntries] = useState("");
    const [finalChips, setFinalChips] = useState("");

    const handleAdd = () => {
        const entryCount = parseFloat(entries);
        const chipsCount = parseFloat(finalChips);
        if (!playerName || isNaN(entryCount) || isNaN(chipsCount)) return;

        const pnlChips = chipsCount - (entryCount * config.chipsPerEntry);
        const pnlCNY = pnlChips * (config.cnyPerEntry / config.chipsPerEntry);

        onAddPlayer({
            id: Date.now() + Math.random(),
            name: playerName,
            entries: entryCount,
            totalBuyInChips: Math.round(entryCount * config.chipsPerEntry),
            finalChips: Math.round(chipsCount),
            pnlChips: Math.round(pnlChips),
            pnlCNY,
            adjustedPnLCNY: pnlCNY
        });

        setPlayerName("");
        setEntries("");
        setFinalChips("");
    };

    return (
        <Card className="rounded-xl overflow-hidden shadow-sm">
            <CardHeader className="bg-muted/50 border-b py-5 px-6">
                <CardTitle className="text-lg font-bold">本局配置与录入</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pt-6 pb-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">牌局名称 (选填)</Label>
                        <Input
                            value={sessionName}
                            onChange={(e) => setSessionName(e.target.value)}
                            placeholder="例如: 周五养生局"
                            disabled={disabled}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">牌局日期</Label>
                        <Input
                            type="date"
                            value={sessionDate}
                            onChange={(e) => setSessionDate(e.target.value)}
                            disabled={disabled}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b">
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">每手买入筹码数</Label>
                        <Input
                            type="number"
                            value={config.chipsPerEntry}
                            onChange={(e) => setConfig({ ...config, chipsPerEntry: parseFloat(e.target.value) || 0 })}
                            disabled={disabled}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">每手买入对应 CNY</Label>
                        <Input
                            type="number"
                            value={config.cnyPerEntry}
                            onChange={(e) => setConfig({ ...config, cnyPerEntry: parseFloat(e.target.value) || 0 })}
                            disabled={disabled}
                        />
                    </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-6 border border-dashed text-center">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-6 tracking-wider">添加玩家数据</p>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2 text-left">
                            <Input
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder="玩家姓名"
                                disabled={disabled}
                                autoComplete="off"
                            />
                        </div>
                        <div className="space-y-2 text-left">
                            <Input
                                type="number"
                                value={entries}
                                onChange={(e) => setEntries(e.target.value)}
                                placeholder="净买入次数"
                                disabled={disabled}
                            />
                        </div>
                        <div className="space-y-2 text-left">
                            <Input
                                type="number"
                                value={finalChips}
                                onChange={(e) => setFinalChips(e.target.value)}
                                placeholder="最终筹码"
                                disabled={disabled}
                            />
                        </div>
                        <Button
                            onClick={handleAdd}
                            className="w-full font-bold shadow-sm"
                            disabled={disabled || !playerName || !entries || !finalChips}
                        >
                            <Plus className="w-4 h-4 mr-1" /> 添加玩家
                        </Button>
                    </div>
                    {historicalPlayers.length > 0 && (
                        <div className="mt-6 text-left border-t border-muted pt-4">
                            <ScrollArea className="h-[40px]">
                                <div className="flex flex-wrap gap-1.5">
                                    {historicalPlayers.map(name => (
                                        <button
                                            key={name}
                                            onClick={() => setPlayerName(name)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all cursor-pointer",
                                                playerName === name
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-white dark:bg-card border hover:border-primary/50 text-muted-foreground"
                                            )}
                                            disabled={disabled}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
