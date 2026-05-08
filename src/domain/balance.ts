/**
 * 밸런스 v0.1 상수. 모든 수치는 docs/BALANCE.md의 표와 1:1 대응.
 * 변경 시 문서도 함께 갱신할 것.
 */
import type { GenreId, PromoTier, ThemeId } from './types';

export const BALANCE = {
  /** 정배치 직원 1명이 1주에 내는 진행도(%) — 3명 정배치 시 약 +10.5%/주 (목표 +9~11%). */
  matchedProgressPerWeek: 3.5,
  /** 오배치 시 진행 기여 배수. */
  mismatchContribFactor: 0.5,
  /** 오배치 직원 1명당 추가 BugDebt. */
  mismatchBugDebt: 2,
  /** 매주 기본 BugDebt 증가. */
  baseBugDebtPerWeek: 6,
  /** 야근 ON 시 BugDebt 가산(+4). */
  crunchBugDebtBonus: 4,
  /** 야근 ON 시 Progress 배수. */
  crunchProgressMul: 1.18,
  /** 폴리싱 1주당 BugDebt 변화량(음수). */
  polishBugDebtDelta: -12,
  /** 연체 1주당 골드 페널티(음수). */
  overrunGoldPenalty: -8,
  /** G1 튜토리얼 목표 주 수. */
  tutorialWeeksTarget: 10,
  /** Appeal — 정배치 슬롯별 주당 기여(점). 오배치는 mismatchContribFactor=0.5 곱. */
  appealBySlot: {
    planning: 0.6,
    graphics: 1.5,
    qa: 1.2,
    programming: 0.2,
  },
  /** QA 슬롯이 비어 있을 때 매 주 Appeal 페널티 (테스트 부족 → 마감 디테일 ↓). */
  appealSoundEmpty: -0.3,
  /** 야근 ON 시 Appeal 보너스(폴리싱 분위기). */
  appealCrunchBonus: 0.4,
  /** 리뷰 점수에서 Appeal 가중. score += round(appeal * factor). */
  appealReviewFactor: 0.3,
  /** Appeal 활성 시 리뷰 base score (튜토리얼은 80, 2작부터 70 + appeal). */
  appealEnabledBaseScore: 70,
  /** 사무실 1→2 업그레이드 비용 (골드). */
  officeUpgradeCost: 300,
  /** 사무실 단계별 고용 상한. */
  officeHireCap: { 1: 3, 2: 4 },
} as const;

/**
 * 직원 컨디션(사기·체력) 모델 — Slice 6.
 *
 * 매 주(advanceWeek) 끝에 직원별로 상태를 업데이트하고, 다음 주 작업 기여는
 * effective skill = skill × moraleFactor × staminaFactor로 계산.
 *
 * 튜닝 의도:
 *  - 야근 OFF 정배치 10주: stamina 100 → 70 (피곤하지만 견딜 만)
 *  - 야근 ON 정배치 10주: stamina 100 → 40 (확연히 떨어짐), morale 70 → 60
 *  - 폴리싱·미배치 1주: stamina +12 (1주 휴식이면 거의 회복)
 */
export const CONDITION = {
  /** 정배치 시 매주 stamina 변화. */
  staminaMatched: -3,
  /** 오배치 시 매주 stamina 변화 (더 빠른 소모). */
  staminaMismatch: -5,
  /** 미배치/폴리싱 시 매주 stamina 변화 (회복). */
  staminaRest: 12,
  /** 야근 ON 시 stamina 추가 가산(음수). */
  staminaCrunchExtra: -3,

  /** 야근 ON 시 매주 morale 변화. */
  moraleCrunch: -1,
  /** BugDebt가 임계 초과면 morale 추가 감소. */
  moraleBugDebtThreshold: 70,
  moraleBugDebtPenalty: -1,

  /** Effective skill 곱연산 인자. morale/stamina 0~100을 [min, min+range]로 매핑. */
  moraleFactorMin: 0.6,
  moraleFactorRange: 0.4, // morale 100 → 1.0
  staminaFactorMin: 0.5,
  staminaFactorRange: 0.5, // stamina 100 → 1.0

  /** 새 직원 기본값. */
  defaultMorale: 70,
  defaultStamina: 100,
} as const;

/**
 * 직원 스킬 성장 — Slice 8.
 *
 * 정배치 작업이 누적될수록 effective skill이 자연스럽게 올라가, 같은 사람도 작품
 * 수가 쌓일수록 더 많은 기여를 한다. 출시 시 추가 보너스로 한 작품을 마칠 때마다
 * 작은 보상이 가시화된다.
 *
 * 진행 모델:
 *  - 정배치 매주: skill +0.005 (10주 → +0.05, +5%)
 *  - 출시 시 정배치 직원: skill +0.05 (한 작품 +5%)
 *  → 한 작품(10주) 정배치 직원 누적 +0.10 = +10%
 *  → 약 10작품에 cap 도달
 */
export const SKILL_GROWTH = {
  /** 정배치 직원 매주 누적. */
  perWeekMatched: 0.005,
  /** 출시 시점 정배치 직원 일회성 보너스. */
  perReleaseBonus: 0.05,
  /** v1 스킬 상한. */
  maxSkill: 2.0,
} as const;

/**
 * 장르/테마 보정. 튜토리얼 G1+T1은 baseline(1.0).
 * 곱연산으로 advanceWeek에 적용 — progressMul, bugMul 모두 (genreMul × themeMul) 형태.
 * 야근(crunch) 보너스/페널티는 별도 가산.
 */
export const GENRE_MOD: Readonly<Record<GenreId, { progressMul: number; bugMul: number }>> = {
  G1: { progressMul: 1.0, bugMul: 1.0 },
  /** G2 — 디버깅 부담↑ */
  G2: { progressMul: 0.9, bugMul: 1.2 },
  /** G3 — 그래픽 부담↓, 진행 약간 빠름 */
  G3: { progressMul: 1.05, bugMul: 0.95 },
};

export const THEME_MOD: Readonly<Record<ThemeId, { progressMul: number; bugMul: number }>> = {
  T1: { progressMul: 1.0, bugMul: 1.0 },
  /** T2 — 회의가 레벨이다: 진행 살짝 느리지만 버그 적음 */
  T2: { progressMul: 0.95, bugMul: 0.9 },
  /** T3 — 버그한테 잡아먹힘: 버그 ↑ */
  T3: { progressMul: 1.0, bugMul: 1.1 },
};

/**
 * 홍보 — BALANCE.md §7 v0.2 튜닝. cost는 출시 직전 차감, revenueMul은 매출에 곱, reviewBonus는 score에 가산.
 * v0.1은 net 골드가 마이너스라 "누르면 손해" 함정 — small/medium 모두 score 50대에서 손익 흑자가 되도록 상향.
 */
export const PROMO: Readonly<
  Record<PromoTier, { cost: number; revenueMul: number; reviewBonus: number; label: string }>
> = {
  none: { cost: 0, revenueMul: 1.0, reviewBonus: 0, label: '없음' },
  small: { cost: 40, revenueMul: 1.18, reviewBonus: 2, label: '소' },
  medium: { cost: 100, revenueMul: 1.4, reviewBonus: 5, label: '중' },
};
