/**
 * 밸런스 v0.1 상수. 모든 수치는 docs/BALANCE.md의 표와 1:1 대응.
 * 변경 시 문서도 함께 갱신할 것.
 */
import type { DressCode, GenreId, PromoTier, Rank, ThemeId, TrendId } from './types';

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
 * Burn Rate (PIVOT-4) — 매주 자동 차감.
 *
 * 직원 인건비(직급별) + 사무실 임대료. advanceWeek/polishWeek 시 합산해 골드에서 빼고,
 * 골드 0 이하로는 가지 않도록 clamp.
 *
 * 튜토리얼 가정 (junior 3명 + 1단계): 3×10 + 0 = 30g/주. 10주 = 300g 압박.
 *  → 첫 매출 ~275g와 비등 → 흑자 내려면 폴리싱·홍보·진급 신경 써야 함.
 */
export const BURN = {
  /** 직급별 매주 인건비. */
  payrollByRank: {
    newbie: 8,
    junior: 10,
    senior: 15,
    lead: 20,
  },
  /** 사무실 단계별 매주 임대료. */
  officeRentByStage: {
    1: 0,
    2: 10,
  },
} as const;

/**
 * 명성 (Reputation) — 영구 누적, 출시 시 별점에 비례해 증가.
 * 매출에 곱연산 보너스로 작용해 후반 작품일수록 더 큰 매출.
 */
export const REPUTATION = {
  /** 출시 시 명성 증가량 = stars × this. */
  perStarOnRelease: 5,
  /** 매출 배수 = 1 + reputation / divisor. */
  revenueBonusDivisor: 300,
} as const;

/**
 * 정책·복지 (PIVOT-5).
 *
 * - 출퇴근 drain: 사무실 단계별 매주 stamina −. 셔틀 도입 시 일부 상쇄.
 * - 재택근무: drain 0 + 사기 +/주, BugDebt +/주, remoteSlacker 트레이트 직원은 effective skill ×0.5.
 * - 복장: skillMul과 morale 매주 가산.
 * - 복지(perks): 영구 구매, 매주 작은 morale/stamina 보너스 누적.
 */
export const COMMUTE_DRAIN_BY_OFFICE: Readonly<Record<1 | 2, number>> = {
  1: 2,
  2: 4,
};

export const REMOTE = {
  moralePerWeek: 1,
  bugDebtPerWeek: 1,
  /** remoteSlacker 트레이트 직원만 발현 (재택 ON일 때 effective skill ×). */
  villainSkillMul: 0.5,
} as const;

export const DRESS_CODE_EFFECT: Readonly<
  Record<DressCode, { skillMul: number; moralePerWeek: number }>
> = {
  casual_free: { skillMul: 1.02, moralePerWeek: 1 },
  casual_guide: { skillMul: 1.0, moralePerWeek: 0 },
  formal: { skillMul: 1.0, moralePerWeek: -1 },
};

/** 복지 항목별 가격(1회) + 매주 효과. */
export const PERK = {
  shuttle: { price: 100, label: '통근 셔틀', staminaPerWeek: 2 },
  teamHoodie: { price: 100, label: '후드 팀복', moralePerWeek: 1 },
  espresso: { price: 50, label: '캡슐 커피머신', moralePerWeek: 1 },
  cafeteria: { price: 200, label: '사내 식당', moralePerWeek: 2 },
} as const;

/**
 * 시장 트렌드 (PIVOT-6). 매 N개 작품마다 새 트렌드 결정.
 *
 * 단순화 — 트렌드는 출시 매출에 genre/theme 매치별 곱연산만 적용.
 * Progress/BugDebt 메커닉은 그대로 (혼란 줄임).
 */
export interface Trend {
  readonly id: TrendId;
  readonly name: string;
  readonly desc: string;
  readonly genreMul: Partial<Record<GenreId, number>>;
  readonly themeMul: Partial<Record<ThemeId, number>>;
}

export const TRENDS: Readonly<Record<TrendId, Trend>> = {
  ai_spring: {
    id: 'ai_spring',
    name: 'AI 봄',
    desc: 'AI/추천 서비스 매출 ↑, 광고 ↓',
    genreMul: { G3: 1.3, G1: 0.85 },
    themeMul: {},
  },
  commerce_winter: {
    id: 'commerce_winter',
    name: '커머스 겨울',
    desc: '커머스 시장 위축. 광고는 비교적 안정',
    genreMul: { G2: 0.8, G1: 1.05 },
    themeMul: {},
  },
  platform_consolidation: {
    id: 'platform_consolidation',
    name: '플랫폼 통합기',
    desc: '커머스 플랫폼 매출 ↑, AI 신뢰 회의',
    genreMul: { G2: 1.2, G3: 0.9 },
    themeMul: {},
  },
  remote_first: {
    id: 'remote_first',
    name: '리모트 퍼스트',
    desc: '회의 적은 조직이 빛난다',
    genreMul: {},
    themeMul: { T2: 0.85, T1: 1.1 },
  },
  data_governance: {
    id: 'data_governance',
    name: '데이터 거버넌스 강화',
    desc: 'AI/추천이 위축, 안정 운영이 보상받음',
    genreMul: { G3: 0.85 },
    themeMul: { T2: 1.15 },
  },
  metaverse_thaw: {
    id: 'metaverse_thaw',
    name: '메타버스 해빙',
    desc: '몰입 콘텐츠 살짝 회복. 모든 장르 약간 +',
    genreMul: { G1: 1.05, G2: 1.05, G3: 1.05 },
    themeMul: {},
  },
};

/** 트렌드 1개당 유지되는 작품 수. */
export const TREND_DURATION = 2;

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
 * 직급 — PIVOT-3.
 *
 * effective skill = skill × condition × RANK_MULTIPLIER × trait × leadBonus.
 *
 * 진급은 출시 시점에 정배치 직원에게만 평가됨:
 *  - shippedProjects ≥ ships  AND  skill ≥ skillReq  → 다음 단계로
 *  - 한 작품에 여러 단계 동시 진급은 없음 (한 단계씩)
 */
export const RANK_MULTIPLIER: Readonly<Record<Rank, number>> = {
  newbie: 0.6,
  junior: 1.0,
  senior: 1.4,
  lead: 1.6,
};

export const RANK_NEXT: Readonly<Record<Rank, Rank | null>> = {
  newbie: 'junior',
  junior: 'senior',
  senior: 'lead',
  lead: null,
};

/** 다음 단계로 가기 위한 최소 조건. lead는 더 갈 곳 없음(null). */
export const RANK_PROMOTION: Readonly<Record<Rank, { ships: number; skill: number } | null>> = {
  newbie: { ships: 1, skill: 0 },
  junior: { ships: 3, skill: 1.3 },
  senior: { ships: 5, skill: 1.6 },
  lead: null,
};

/** 리더 1명당 다른 직원 effective skill에 합산되는 보너스(곱연산). */
export const LEAD_TEAM_BONUS = 0.05;

/**
 * 트레이트별 효과. 일부는 advanceWeek에서, 일부는 이벤트 트리거에서 사용.
 * v1 PIVOT-3에서 effectiveSkill에 적용되는 것만 정의. 다른 효과는 PIVOT-3.5+에서.
 */
export const TRAIT_EFFECT = {
  /** 고인물 — 평소 기여가 강함. */
  oldTimer: { effectiveSkillMul: 1.3 },
  /** 입 개발 — 평소 기여 약함 (해커톤 보너스는 별도). */
  allTalk: { effectiveSkillMul: 0.7 },
  /** 재택 빌런 — PIVOT-5 재택 시스템과 함께. */
  remoteSlacker: { effectiveSkillMul: 1.0 }, // 평소엔 정상, 재택 발현 시 별도
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
