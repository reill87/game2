/**
 * 출시 결과 산정 — 순수 함수.
 * 모든 수치는 docs/BALANCE.md v0.1 대역에 맞춤. 추후 문서 갱신과 함께 조정.
 */
import { BALANCE, PROMO, RANK_NEXT, RANK_PROMOTION, REPUTATION, SKILL_GROWTH } from './balance';
import { isMatched, SLOT_ORDER } from './match';
import { release } from './tick';
import type { Employee, GameState, PromoTier, Rank } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 한 단계 진급 가능하면 다음 단계, 아니면 현 단계 그대로. 한 번에 한 단계만. */
function checkPromotion(rank: Rank, ships: number, skill: number): Rank {
  const next = RANK_NEXT[rank];
  const req = RANK_PROMOTION[rank];
  if (!next || !req) return rank;
  if (ships >= req.ships && skill >= req.skill) return next;
  return rank;
}

/** 출시 직후 변경된 직급(진급한 직원)을 비교해 알림용 목록을 만든다. */
export function diffPromotions(
  before: ReadonlyArray<Employee>,
  after: ReadonlyArray<Employee>,
): ReadonlyArray<{ employee: Employee; from: Rank; to: Rank }> {
  const beforeMap = new Map(before.map((e) => [e.id, e] as const));
  const promotions: { employee: Employee; from: Rank; to: Rank }[] = [];
  for (const a of after) {
    const b = beforeMap.get(a.id);
    if (b && b.rank !== a.rank) promotions.push({ employee: a, from: b.rank, to: a.rank });
  }
  return promotions;
}

export type ReviewStars = 1 | 2 | 3 | 4 | 5;

export interface ReleaseOutcome {
  readonly reviewScore: number;
  readonly stars: ReviewStars;
  readonly headline: string;
  readonly revenue: number;
  /** 컴포넌트 분해 — UI 표시·튜닝용. 합 = score (clamp 전). */
  readonly breakdown: {
    readonly base: number;
    readonly bugPenalty: number;
    readonly overrunPenalty: number;
    readonly polishBonus: number;
    /** Appeal이 활성화된 작품에서만 0보다 큼. */
    readonly appealBonus: number;
    /** 홍보 단계에 따른 리뷰 가산. */
    readonly promoBonus: number;
  };
  readonly promo: {
    readonly tier: PromoTier;
    readonly cost: number;
    readonly revenueMul: number;
  };
  /** 명성 — 출시 시 누적. UI 표시용. */
  readonly reputation: {
    /** 이번 출시로 +N. */
    readonly gain: number;
    /** 매출에 적용된 명성 보너스 배수. */
    readonly multiplier: number;
    /** 누적 명성 (이번 출시 후). */
    readonly total: number;
  };
  /** released=true, gold = (prev.gold − promo.cost) + revenue. reputation도 누적. */
  readonly state: GameState;
}

const HEADLINE_BY_STARS: Readonly<Record<ReviewStars, string>> = {
  5: '★★★★★ 완성도가 빛난다.',
  4: '★★★★ 단단한 첫 작품.',
  3: '★★★ 무난하지만 거친 부분이 있다.',
  2: '★★ 야근 자국이 그대로 보인다.',
  1: '★ 출시한 것 자체가 성과.',
};

function computeStars(score: number): ReviewStars {
  if (score >= 80) return 5;
  if (score >= 65) return 4;
  if (score >= 50) return 3;
  if (score >= 35) return 2;
  return 1;
}

function computeReview(state: GameState, polishCount: number): {
  rawScore: number;
  base: number;
  bugPenalty: number;
  overrunPenalty: number;
  polishBonus: number;
  appealBonus: number;
} {
  const { project } = state;
  const base = project.appealEnabled ? BALANCE.appealEnabledBaseScore : 80;
  const bugPenalty = Math.round(project.bugDebt * 0.5);
  const overrun = Math.max(0, project.weeksElapsed - project.weeksTarget);
  const overrunPenalty = overrun * 3;
  const polishBonus = Math.min(polishCount * 2, 6);
  const appealBonus = project.appealEnabled
    ? Math.round(project.appeal * BALANCE.appealReviewFactor)
    : 0;
  // promo bonus는 shipProject에서 합쳐 clamp.
  const rawScore = base - bugPenalty - overrunPenalty + polishBonus + appealBonus;
  return { rawScore, base, bugPenalty, overrunPenalty, polishBonus, appealBonus };
}

/** BALANCE.md 첫 매출 대역 약 150~400 골드. */
function computeRevenue(score: number): number {
  return Math.round(150 + score * 2.5);
}

export function shipProject(
  prev: GameState,
  polishCount: number,
  promoTier: PromoTier = 'none',
): ReleaseOutcome {
  const r = computeReview(prev, polishCount);
  const promo = PROMO[promoTier];
  // 홍보 비용이 보유 골드보다 크면 자동으로 'none'으로 강등.
  const effectiveTier: PromoTier = prev.gold >= promo.cost ? promoTier : 'none';
  const eff = PROMO[effectiveTier];

  const finalScore = clamp(r.rawScore + eff.reviewBonus, 0, 100);
  const stars = computeStars(finalScore);
  const baseRevenue = computeRevenue(finalScore);
  // 명성 보너스 — 누적 명성에 비례한 매출 곱연산. 명성 300 = 매출 2배.
  const reputationMul = 1 + prev.reputation / REPUTATION.revenueBonusDivisor;
  const revenue = Math.round(baseRevenue * eff.revenueMul * reputationMul);
  const reputationGain = stars * REPUTATION.perStarOnRelease;
  const newReputation = prev.reputation + reputationGain;

  const goldAfterPromo = Math.max(0, prev.gold - eff.cost);

  // 정배치 직원에게 출시 보너스: skill ↑ + shippedProjects ↑ + 진급 평가.
  const placedAndMatched = new Set<string>();
  for (const slot of SLOT_ORDER) {
    const id = prev.assignment[slot];
    if (!id) continue;
    const emp = prev.employees.find((e) => e.id === id);
    if (emp && isMatched(slot, emp.job)) placedAndMatched.add(id);
  }
  const boostedEmployees = prev.employees.map((e) => {
    if (!placedAndMatched.has(e.id)) return e;
    const newSkill = clamp(e.skill + SKILL_GROWTH.perReleaseBonus, 0, SKILL_GROWTH.maxSkill);
    const newShipped = e.shippedProjects + 1;
    const newRank = checkPromotion(e.rank, newShipped, newSkill);
    return { ...e, skill: newSkill, shippedProjects: newShipped, rank: newRank };
  });

  const released = release({
    ...prev,
    gold: goldAfterPromo,
    employees: boostedEmployees,
    reputation: newReputation,
  });
  const state: GameState = { ...released, gold: released.gold + revenue };

  return {
    reviewScore: finalScore,
    stars,
    headline: HEADLINE_BY_STARS[stars],
    revenue,
    breakdown: {
      base: r.base,
      bugPenalty: r.bugPenalty,
      overrunPenalty: r.overrunPenalty,
      polishBonus: r.polishBonus,
      appealBonus: r.appealBonus,
      promoBonus: eff.reviewBonus,
    },
    promo: {
      tier: effectiveTier,
      cost: eff.cost,
      revenueMul: eff.revenueMul,
    },
    reputation: {
      gain: reputationGain,
      multiplier: reputationMul,
      total: newReputation,
    },
    state,
  };
}
