import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Calculator, Save, RotateCcw } from "lucide-react";
import type { PlayerResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ResultsTableProps {
    players: PlayerResult[];
    onRemovePlayer: (id: number) => void;
    onClear: () => void;
    onSave: () => void;
    onCalculateTransfers: () => void;
    disabled?: boolean;
}

export function ResultsTable({
    players, onRemovePlayer, onClear, onSave, onCalculateTransfers, disabled
}: ResultsTableProps) {
    const totalBuyIn = players.reduce((s, p) => s + p.totalBuyInChips, 0);
    const totalFinal = players.reduce((s, p) => s + p.finalChips, 0);
    const chipDiscrepancy = totalFinal - totalBuyIn;
    const cnyDiscrepancy = players.reduce((s, p) => s + p.adjustedPnLCNY, 0);

    return (
        <Card className="rounded-xl overflow-hidden shadow-sm">
            <CardHeader className="bg-muted/50 border-b py-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold">当前结算预览</CardTitle>
                <div className="text-sm font-medium">
                    差额: <span className={cn("font-bold", Math.abs(cnyDiscrepancy) > 0.1 ? "text-red-500" : "text-emerald-500")}>
                        {cnyDiscrepancy.toFixed(2)} CNY
                    </span>
                </div>
            </CardHeader>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="px-6">玩家</TableHead>
                            <TableHead className="text-right">总买入</TableHead>
                            <TableHead className="text-right">最终筹码</TableHead>
                            <TableHead className="text-right">P&L (筹码)</TableHead>
                            <TableHead className="text-right">P&L (CNY)</TableHead>
                            <TableHead className="text-right bg-muted/20">调整后 P&L</TableHead>
                            <TableHead className="text-center">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {players.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                                    暂无数据，请在上方添加玩家...
                                </TableCell>
                            </TableRow>
                        ) : (
                            players.map((p) => (
                                <TableRow key={p.id} className="hover:bg-muted/30">
                                    <TableCell className="px-6 font-medium">{p.name}</TableCell>
                                    <TableCell className="text-right font-mono text-sm opacity-80">{p.totalBuyInChips}</TableCell>
                                    <TableCell className="text-right font-mono text-sm opacity-80">{p.finalChips}</TableCell>
                                    <TableCell className={cn(
                                        "text-right font-mono text-sm font-bold",
                                        p.pnlChips > 0 ? "text-emerald-500" : p.pnlChips < 0 ? "text-red-500" : "text-muted-foreground"
                                    )}>
                                        {p.pnlChips > 0 ? `+${p.pnlChips}` : p.pnlChips}
                                    </TableCell>
                                    <TableCell className={cn(
                                        "text-right font-mono text-sm font-bold",
                                        p.pnlCNY > 0 ? "text-emerald-500" : p.pnlCNY < 0 ? "text-red-500" : "text-muted-foreground"
                                    )}>
                                        {p.pnlCNY.toFixed(2)}
                                    </TableCell>
                                    <TableCell className={cn(
                                        "text-right font-mono text-sm font-bold bg-muted/10",
                                        p.adjustedPnLCNY > 0 ? "text-emerald-500" : p.adjustedPnLCNY < 0 ? "text-red-500" : "text-muted-foreground"
                                    )}>
                                        {p.adjustedPnLCNY.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onRemovePlayer(p.id)}
                                            disabled={disabled}
                                            className="text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <CardFooter className="bg-muted/50 border-t p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex gap-4 text-xs font-medium text-muted-foreground">
                    <span>总买入: <b className="text-foreground">{totalBuyIn}</b></span>
                    <span>总剩余: <b className="text-foreground">{totalFinal}</b></span>
                    <span>偏差: <b className={cn(Math.abs(chipDiscrepancy) > 0 ? "text-red-500" : "text-emerald-500")}>
                        {chipDiscrepancy}
                    </b></span>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onCalculateTransfers} disabled={players.length === 0}>
                        <Calculator className="w-4 h-4 mr-1.5" /> 计算转账
                    </Button>
                    <Button variant="outline" size="sm" onClick={onClear} className="text-red-500 hover:text-red-600" disabled={disabled || players.length === 0}>
                        <RotateCcw className="w-4 h-4 mr-1.5" /> 清空
                    </Button>
                    <Button size="sm" onClick={onSave} disabled={disabled || players.length === 0}>
                        <Save className="w-4 h-4 mr-1.5" /> 保存牌局
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
