import { ArrowRight, CheckCircle2 } from "lucide-react";

interface Transfer {
    from: string;
    to: string;
    amount: number;
}

interface TransferListProps {
    transfers: Transfer[];
    visible: boolean;
}

export function TransferList({ transfers, visible }: TransferListProps) {
    if (!visible) return null;

    return (
        <div className="mt-4 border-t pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-emerald-50/50 dark:bg-emerald-500/5 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-500/20">
                <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 uppercase mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> 最佳转账方案
                </h3>
                {transfers.length === 0 ? (
                    <p className="text-emerald-700 dark:text-emerald-300 font-medium">🎉 无需转账，局内已平。</p>
                ) : (
                    <ul className="space-y-3">
                        {transfers.map((t, i) => (
                            <li key={i} className="flex items-center justify-between bg-white dark:bg-card p-3 rounded-xl border border-emerald-200/50 dark:border-emerald-500/10 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-sm min-w-[60px]">{t.from}</span>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-50" />
                                    <span className="font-bold text-sm min-w-[60px]">{t.to}</span>
                                </div>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                                    {t.amount.toFixed(2)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
