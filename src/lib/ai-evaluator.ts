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

    const prompt = `你是德扑圈资深毒舌评论员，请根据每位牌手的数据写一段详细的「风格评价」。

## 格式要求
每位玩家的评价格式如下（每条约 50-80 个汉字）：

[emoji] [风格标签（2-4字创意命名）]
[2-3句话的详细点评，引用具体数据，分析打法特征和风格倾向]

## 示例
🦈 深海鲨鱼
稳如泰山的技术型选手，场均利润221，胜率83%碾压全场。夏普1.49说明赢来的钱全靠技术，来牌桌就是来提款的。

🎰 赌场之友
7场亏了943，胜率只有14%。波动率154，连亏5场，每次都觉得下把能翻盘，结果越陷越深。

🎢 过山车大师
资金曲线比心电图还刺激，波动率703。虽然总体盈利3361，但最大回撤220让人心惊肉跳，典型的大开大合型。

🐢 铁龟禅师
一场定乾坤，胜率100%但只打了一场。数据太少不好说，但至少知道见好就收的道理。

## 写作要求
1. 风格标签要有创意，避免重复，可以用谐音梗/流行语/网络用语
2. 点评要引用具体数据（场均盈亏、胜率、夏普、波动率等），让人信服
3. 语气犀利幽默但不冒犯，像朋友间的调侃
4. 根据数据特征给出差异化评价：
   - sharpe > 1 + winRate > 60% = 技术型
   - volatility 高 + maxDrawdown 大 = 过山车型
   - totalPnL 大负 + winRate 低 = 送财童子型
   - totalSessions ≤ 2 = 样本不足，可以调侃"数据太少"
   - profitFactor 高(>2) = 赚钱效率高
   - maxLosingStreak ≥ 3 = 容易倾斜
5. 每人的评价控制在 50-80 个汉字

## 指标说明
- totalPnL: 总盈亏 (CNY)
- avgPnL: 场均盈亏
- winRate: 胜率 (%)
- sharpe: 夏普比率 (风险调整收益)
- volatility: 波动率 (盈亏标准差)
- profitFactor: 盈亏比 (总盈利/总亏损)
- maxDrawdown: 最大回撤
- maxLosingStreak: 最大连亏场次
- totalSessions: 总参与场次
- score: 综合评分 (50-99)

## 玩家数据
${JSON.stringify(playerData, null, 2)}

请直接返回一个 JSON 对象，格式为 {"玩家名": "完整评价（含emoji和风格标签）"}，不要包含 markdown 代码块标记，不要有任何其他文字。`;

    // Try with retries and model fallback for rate limits
    const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
    let lastError: Error | null = null;

    for (const modelName of models) {
        const model = genAI.getGenerativeModel({ model: modelName });
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                if (attempt > 0) {
                    // Exponential backoff: 2s, 4s, 8s
                    await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
                }
                const result = await model.generateContent(prompt);
                const text = result.response.text().trim();

                const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                try {
                    return JSON.parse(cleaned) as Record<string, string>;
                } catch {
                    const match = cleaned.match(/\{[\s\S]*\}/);
                    if (match) {
                        return JSON.parse(match[0]) as Record<string, string>;
                    }
                    throw new Error("AI 返回格式异常，请重试");
                }
            } catch (e: any) {
                lastError = e;
                const msg = e.message || "";
                // Only retry on 429 rate limit errors
                if (msg.includes("429") || msg.includes("Resource exhausted")) {
                    continue; // retry same model or fall through to next model
                }
                throw e; // non-retryable error, throw immediately
            }
        }
    }

    throw lastError || new Error("所有模型均已超出速率限制，请稍后再试");
}
