/**
 * 분기·연도 메타 시스템.
 * 출시 횟수(productCount)를 기반으로 연차와 분기를 산출하고,
 * 연말(4분기) 결산 보고서를 생성한다.
 */

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export const QUARTERS: ReadonlyArray<Quarter> = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * productCount → (year, quarter) 매핑.
 *  - 첫 출시 (productCount===1): year=1, Q1
 *  - 두 번째 출시: year=1, Q2
 *  - ...
 *  - 5번째: year=2, Q1
 */
export function calendarFor(productCount: number): { year: number; quarter: Quarter } {
  // productCount: 0이면 아직 출시 전. 1부터 시작.
  const idx = Math.max(0, productCount - 1);
  const year = Math.floor(idx / 4) + 1;
  const qIdx = idx % 4;
  return { year, quarter: QUARTERS[qIdx] ?? 'Q1' };
}

/** 분기별 매출 목표 — Q1<Q2<Q3<Q4(연말 압박). */
export const QUARTER_REVENUE_TARGET: Readonly<Record<Quarter, number>> = {
  Q1: 200,
  Q2: 300,
  Q3: 500,
  Q4: 800,
};

/** 연말 보너스 — 4분기 합계 목표 = sum(QUARTER_REVENUE_TARGET) = 1800. */
export const YEAR_END_TARGET = 1800;
export const YEAR_END_GOLD_BONUS = 300;
export const YEAR_END_REPUTATION_BONUS = 30;

/**
 * 연말 결산 — productCount가 4의 배수일 때 호출.
 * 직전 4개 history entries의 매출 합계로 평가.
 */
export interface YearEndReport {
  readonly year: number;
  readonly q1Revenue: number;
  readonly q2Revenue: number;
  readonly q3Revenue: number;
  readonly q4Revenue: number;
  readonly totalRevenue: number;
  readonly target: number;
  readonly achieved: boolean;
  readonly goldBonus: number;
  readonly reputationBonus: number;
}

export function buildYearEndReport(
  productCount: number,
  history: ReadonlyArray<{ readonly revenue: number }>,
): YearEndReport | null {
  if (productCount < 4) return null;
  if (productCount % 4 !== 0) return null;
  const last4 = history.slice(-4);
  if (last4.length < 4) return null;
  const q1 = last4[0]?.revenue ?? 0;
  const q2 = last4[1]?.revenue ?? 0;
  const q3 = last4[2]?.revenue ?? 0;
  const q4 = last4[3]?.revenue ?? 0;
  const total = q1 + q2 + q3 + q4;
  const achieved = total >= YEAR_END_TARGET;
  return {
    year: Math.floor(productCount / 4),
    q1Revenue: q1,
    q2Revenue: q2,
    q3Revenue: q3,
    q4Revenue: q4,
    totalRevenue: total,
    target: YEAR_END_TARGET,
    achieved,
    goldBonus: achieved ? YEAR_END_GOLD_BONUS : 0,
    reputationBonus: achieved ? YEAR_END_REPUTATION_BONUS : 0,
  };
}
