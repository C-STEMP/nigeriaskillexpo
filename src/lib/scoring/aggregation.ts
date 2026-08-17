/**
 * Pure scoring math, matching exactly what was confirmed:
 *   1. Per criterion: average the 3 assessors' scores for that criterion.
 *   2. Trade total = SUM of all criterion averages for that trade entry.
 *      Trade average = trade total / number of criteria (kept for display).
 *   3. Sector total (per state) = SUM of the 3 trade totals representing
 *      that sector in that state.
 * No DB access here — callers fetch the raw Score rows and pass them in,
 * which keeps this trivially testable and avoids accidentally coupling
 * the arithmetic to query shape.
 */

export type RawScore = {
  criterionId: string;
  value: number;
};

export type TradeTotalResult = {
  criterionAverages: { criterionId: string; average: number; scoreCount: number }[];
  tradeTotal: number;
  tradeAverage: number;
};

/**
 * Computes a single trade entry's total from its raw Score rows
 * (potentially from multiple assessors per criterion).
 */
export function computeTradeTotal(scores: RawScore[]): TradeTotalResult {
  const byCriterion = new Map<string, number[]>();
  for (const score of scores) {
    const list = byCriterion.get(score.criterionId) ?? [];
    list.push(score.value);
    byCriterion.set(score.criterionId, list);
  }

  const criterionAverages = Array.from(byCriterion.entries()).map(
    ([criterionId, values]) => ({
      criterionId,
      average: values.reduce((sum, v) => sum + v, 0) / values.length,
      scoreCount: values.length,
    })
  );

  const tradeTotal = criterionAverages.reduce((sum, c) => sum + c.average, 0);
  const tradeAverage =
    criterionAverages.length > 0 ? tradeTotal / criterionAverages.length : 0;

  return { criterionAverages, tradeTotal, tradeAverage };
}

/**
 * Sector total for one state = sum of exactly 3 trade totals. Accepts
 * however many are passed in (the caller is responsible for having
 * already enforced "exactly 3" at the StateTradeEntry level) so this
 * function itself stays a pure, simple sum — but it DOES warn the caller
 * via the returned `isComplete` flag if it doesn't see exactly 3, since a
 * sector total computed from 1 or 2 trades is provisional/incomplete,
 * not a real comparable result yet.
 */
export function computeSectorTotal(tradeTotals: number[]): {
  sectorTotal: number;
  isComplete: boolean;
} {
  const sectorTotal = tradeTotals.reduce((sum, t) => sum + t, 0);
  return { sectorTotal, isComplete: tradeTotals.length === 3 };
}
