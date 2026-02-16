export interface SessionConfig {
    chipsPerEntry: number;
    cnyPerEntry: number;
}

export interface PlayerResult {
    id: number;
    name: string;
    entries: number;
    totalBuyInChips: number;
    finalChips: number;
    pnlChips: number;
    pnlCNY: number;
    adjustedPnLCNY: number;
}

export interface Session {
    id: string;
    date: string;
    name: string;
    config: SessionConfig;
    playerResults: {
        name: string;
        pnlCNY: number;
    }[];
}

export interface PlayerStats {
    name: string;
    totalSessions: number;
    totalPnL: number;
    avgPnL: number;
    winRate: number;
    volatility: number;
    sharpe: number;
    maxLosingStreak: number;
    profitFactor: number;
    maxDrawdown: number;
    score?: number;
}

export interface HistoryEntry {
    sessionId: string;
    date: string;
    pnl: number;
}

export interface ColumnDef {
    id: keyof PlayerStats;
    label: string;
    tooltip?: string;
}

export interface SharedBoard {
    uid: string;
    accessCode: string;
    displayName: string;
}
