import type { PlayerStats, HistoryEntry, PlayerResult } from "./types";

export function adjustDiscrepancy(players: PlayerResult[]): PlayerResult[] {
    const totalPnL = players.reduce((s, p) => s + p.pnlCNY, 0);
    const res = players.map(p => ({ ...p, adjustedPnLCNY: p.pnlCNY }));
    if (Math.abs(totalPnL) < 0.01) return res;

    const mag = Math.abs(totalPnL);
    if (totalPnL > 0) {
        const ws = res.filter(p => p.pnlCNY > 0);
        const tot = ws.reduce((s, p) => s + p.pnlCNY, 0);
        if (tot) ws.forEach(p => p.adjustedPnLCNY -= mag * (p.pnlCNY / tot));
    } else {
        const ls = res.filter(p => p.pnlCNY < 0);
        const tot = ls.reduce((s, p) => s + Math.abs(p.pnlCNY), 0);
        if (tot) ls.forEach(p => p.adjustedPnLCNY += mag * (Math.abs(p.pnlCNY) / tot));
    }
    return res;
}

export function calculateTransfers(players: { name: string; pnl: number }[]) {
    const winners = players.filter(p => p.pnl > 0).sort((a, b) => b.pnl - a.pnl);
    const losers = players.filter(p => p.pnl < 0).sort((a, b) => a.pnl - b.pnl);
    const txs: { from: string; to: string; amount: number }[] = [];

    while (winners.length && losers.length) {
        const w = winners[0];
        const l = losers[0];
        const amt = Math.min(w.pnl, Math.abs(l.pnl));
        txs.push({ from: l.name, to: w.name, amount: amt });
        w.pnl -= amt;
        l.pnl += amt;
        if (w.pnl < 0.01) winners.shift();
        if (Math.abs(l.pnl) < 0.01) losers.shift();
    }
    return txs;
}

export function calculateMetrics(name: string, history: HistoryEntry[]): PlayerStats {
    const pnls = history.map(h => h.pnl);
    const n = pnls.length;
    if (!n) return { name, score: 0, totalPnL: 0, avgPnL: 0, winRate: 0, volatility: 0, sharpe: 0, maxLosingStreak: 0, totalSessions: 0, profitFactor: 0, maxDrawdown: 0 };

    const tot = pnls.reduce((a, b) => a + b, 0);
    const avg = tot / n;
    const vari = pnls.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / n;
    const vol = Math.sqrt(vari);
    let ls = 0, maxLs = 0;
    pnls.forEach(p => { if (p < -0.01) ls++; else ls = 0; maxLs = Math.max(maxLs, ls); });

    const grossProfit = pnls.filter(p => p > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(pnls.filter(p => p < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;

    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sortedPnls = sortedHistory.map(h => h.pnl);

    for (const pnl of sortedPnls) {
        cumulative += pnl;
        if (cumulative > peak) peak = cumulative;
        const dd = peak - cumulative;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
        name,
        totalSessions: n,
        totalPnL: tot,
        avgPnL: avg,
        winRate: (pnls.filter(p => p > 0.01).length / n) * 100,
        volatility: vol,
        sharpe: vol > 0 ? avg / vol : 0,
        maxLosingStreak: maxLs,
        profitFactor: profitFactor,
        maxDrawdown: maxDrawdown
    };
}

export function calculateCompositeScores(stats: PlayerStats[]): PlayerStats[] {
    if (stats.length === 0) return [];

    const cleanStats = stats.map(s => {
        let sh = s.sharpe;
        if (!isFinite(sh)) sh = s.avgPnL > 0 ? 10 : -1;

        let pf = s.profitFactor;
        if (!isFinite(pf)) pf = 20;

        return { ...s, _sh: sh, _pf: pf };
    });

    const getRange = (key: "_sh" | "_pf" | "avgPnL" | "winRate" | "maxDrawdown" | "totalSessions") => {
        const values = cleanStats.map(s => s[key] as number);
        return { min: Math.min(...values), max: Math.max(...values) };
    };

    const ranges = {
        sharpe: getRange('_sh'),
        profitFactor: getRange('_pf'),
        avgPnL: getRange('avgPnL'),
        winRate: getRange('winRate'),
        maxDrawdown: getRange('maxDrawdown'),
        totalSessions: getRange('totalSessions')
    };

    const normalize = (val: number, min: number, max: number, invert = false) => {
        if (max === min) return 0.5;
        const norm = (val - min) / (max - min);
        return invert ? 1 - norm : norm;
    };

    const W = {
        sharpe: 0.25,
        profitFactor: 0.20,
        avgPnL: 0.15,
        winRate: 0.15,
        maxDrawdown: 0.15,
        sessions: 0.10
    };

    return cleanStats.map(s => {
        const n_sh = normalize(s._sh, ranges.sharpe.min, ranges.sharpe.max);
        const n_pf = normalize(s._pf, ranges.profitFactor.min, ranges.profitFactor.max);
        const n_ap = normalize(s.avgPnL, ranges.avgPnL.min, ranges.avgPnL.max);
        const n_wr = normalize(s.winRate, ranges.winRate.min, ranges.winRate.max);
        const n_md = normalize(s.maxDrawdown, ranges.maxDrawdown.min, ranges.maxDrawdown.max, true);
        const n_ss = normalize(s.totalSessions, ranges.totalSessions.min, ranges.totalSessions.max);

        const raw = (n_sh * W.sharpe) + (n_pf * W.profitFactor) + (n_ap * W.avgPnL) + (n_wr * W.winRate) + (n_md * W.maxDrawdown) + (n_ss * W.sessions);
        return { ...s, score: 50 + (raw * 49) };
    });
}
