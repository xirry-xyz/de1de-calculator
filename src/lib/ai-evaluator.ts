import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PlayerStats } from "./types";

const STORAGE_KEY = "de1de_gemini_api_key";

export function getStoredApiKey(): string {
    return localStorage.getItem(STORAGE_KEY) || "";
}

export function storeApiKey(key: string): void {
    if (key.trim()) {
        localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
}

export async function generateStyleEvaluations(
    apiKey: string,
    stats: PlayerStats[]
): Promise<Record<string, string>> {
    if (!apiKey || stats.length === 0) return {};

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const playerData = stats.map(s => ({
        name: s.name,
        score: Math.round(s.score || 0),
        totalPnL: Math.round(s.totalPnL),
        avgPnL: Math.round(s.avgPnL),
        winRate: Math.round(s.winRate),
        sharpe: Number(s.sharpe.toFixed(2)),
        volatility: Math.round(s.volatility),
        profitFactor: s.profitFactor === Infinity ? 99 : Number(s.profitFactor.toFixed(2)),
        maxDrawdown: Math.round(s.maxDrawdown),
        maxLosingStreak: s.maxLosingStreak,
        totalSessions: s.totalSessions
    }));

    const prompt = `你是德扑圈资深毒舌评论员，给每位牌手写一句有趣的「风格评价」。
要求：
1. 以一个有特色的 emoji 开头
2. 紧跟一个 2-4 字的风格标签（创意命名，如「印钞机」「过山车专家」「慈善大使」「深海鲨鱼」「铁龟禅师」「赌场之友」等）
3. 然后用破折号连接一句话（15字以内）精准点评其打法特征
4. 风格要犀利、幽默、接地气，但不冒犯人
5. 必须基于数据，不同数据特征要给出截然不同的评价
6. 每个评价总长度控制在 25 字以内

关键解读指南：
- sharpe 高(>1) + winRate 高(>60) = 技术型稳健选手
- sharpe 低/负 + volatility 高 = 赌徒型/大起大落
- totalPnL 大负 + maxDrawdown 大 = 常输型
- totalPnL 大正 + profitFactor 高 = 赢钱机器
- winRate 高但 avgPnL 低 = 小赢型，赢多输少但赢的少
- maxLosingStreak 高 = 容易倾斜/连黑
- totalSessions 少(≤3) = 新手/样本不足

玩家数据:
${JSON.stringify(playerData, null, 2)}

请直接返回一个 JSON 对象，格式为 {"玩家名": "评价内容"}，不要包含 markdown 代码块标记，不要有任何其他文字。`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code block if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
        return JSON.parse(cleaned) as Record<string, string>;
    } catch {
        // Try to extract JSON from the response
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]) as Record<string, string>;
        }
        throw new Error("AI 返回格式异常，请重试");
    }
}
