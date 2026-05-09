/**
 * 프레스티지(NewGame+) 도메인 — 유니콘 엔딩 도달 후 회사를 초기화하되
 * 영구 보너스를 누적해 다회차 플레이의 메타 진행감을 제공한다.
 *
 * 보너스 스케일:
 *  - 1회: 시작 골드 +500, 매출 ×1.05
 *  - 2회: 시작 골드 +1000, 매출 ×1.10, skill +0.05
 *  - N회: 골드 +N×500, 매출 ×(1+N×0.05), skill +N×0.05, burnRate ×(max 0.5, 1-N×0.05)
 */

/** 프레스티지 누적 보너스. */
export interface PrestigeBonus {
  /** 게임 시작 골드 보너스. */
  readonly startingGoldBonus: number;
  /** 모든 매출 ×N. */
  readonly revenueMul: number;
  /** 직원 skill 시작 가산. */
  readonly skillBonus: number;
  /** burn rate ×N (낮을수록 유리). */
  readonly burnRateMul: number;
}

/**
 * 프레스티지 회수 → 보너스 계산.
 *  - 1회: 시작 골드 +500, 매출 ×1.05
 *  - 2회: +1000, ×1.10, skill +0.05
 *  - 3회+: 회수당 골드 +500, 매출 +0.05, skill +0.05, burnRate -0.05 (하한 0.5)
 */
export function computePrestigeBonus(prestigeCount: number): PrestigeBonus {
  return {
    startingGoldBonus: prestigeCount * 500,
    revenueMul: 1 + prestigeCount * 0.05,
    skillBonus: prestigeCount * 0.05,
    burnRateMul: Math.max(0.5, 1 - prestigeCount * 0.05),
  };
}

/** 프레스티지 보너스가 없는 기본값 (0회). */
export const NO_PRESTIGE: PrestigeBonus = {
  startingGoldBonus: 0,
  revenueMul: 1,
  skillBonus: 0,
  burnRateMul: 1,
};
