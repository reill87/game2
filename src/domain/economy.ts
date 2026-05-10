/**
 * 외부 경기 사이클 — 매 N 출시마다 재계산.
 * 호황 / 평년 / 침체가 매출·비용에 곱연산 보정.
 */

/** 경기 단계 — 매 4분기(=4 출시)마다 재계산. */
export type EconomyPhase = 'boom' | 'normal' | 'recession';

export interface EconomyState {
  /** 현재 경기 지표 0~100. 50이 평년. */
  readonly index: number;
  /** 매 N 출시마다 재계산용 카운터. */
  readonly cyclesElapsed: number;
}

export const EMPTY_ECONOMY: EconomyState = { index: 50, cyclesElapsed: 0 };
export const ECONOMY_CYCLE_INTERVAL = 4;  // 4작 마다 재계산

export function getEconomyPhase(idx: number): EconomyPhase {
  if (idx >= 70) return 'boom';
  if (idx <= 30) return 'recession';
  return 'normal';
}

export const ECONOMY_PHASE_LABEL: Readonly<Record<EconomyPhase, string>> = {
  boom: '호황',
  normal: '평년',
  recession: '침체',
};

/** 매출 곱연산 — 호황 +50%, 평년 0%, 침체 -40%. */
export function getEconomyRevenueMul(phase: EconomyPhase): number {
  if (phase === 'boom') return 1.5;
  if (phase === 'recession') return 0.6;
  return 1.0;
}

/** 비용 곱연산 — 호황 +20%, 평년 0%, 침체 -10% (비용 절감). */
export function getEconomyCostMul(phase: EconomyPhase): number {
  if (phase === 'boom') return 1.2;
  if (phase === 'recession') return 0.9;
  return 1.0;
}

/**
 * 매 출시마다 호출. cyclesElapsed +1, ECONOMY_CYCLE_INTERVAL 도달 시 새 index 추첨.
 * 새 index는 random 0~100 (확률 분포: 평년 50%, 호황 25%, 침체 25%).
 * 반환값에 cyclesElapsed===0 이면 새 사이클이 시작된 것.
 */
export function tickEconomy(prev: EconomyState | undefined): EconomyState {
  const cur = prev ?? EMPTY_ECONOMY;
  const next = cur.cyclesElapsed + 1;
  if (next < ECONOMY_CYCLE_INTERVAL) return { ...cur, cyclesElapsed: next };
  // 재추첨
  const r = Math.random();
  let newIndex = 50;  // 평년 기본
  if (r < 0.25) newIndex = 20 + Math.floor(Math.random() * 15);  // 침체 (20~35)
  else if (r < 0.5) newIndex = 75 + Math.floor(Math.random() * 20);  // 호황 (75~95)
  else newIndex = 40 + Math.floor(Math.random() * 25);  // 평년 (40~65)
  return { index: newIndex, cyclesElapsed: 0 };
}
