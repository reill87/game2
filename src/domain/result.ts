/**
 * 출시 결과 산정 — 순수 함수.
 * 모든 수치는 docs/BALANCE.md v0.1 대역에 맞춤. 추후 문서 갱신과 함께 조정.
 */
import { release } from './tick';
import type { GameState } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
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
  };
  /** released=true, gold += revenue. */
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
  score: number;
  base: number;
  bugPenalty: number;
  overrunPenalty: number;
  polishBonus: number;
} {
  const { project } = state;
  const base = 80;
  const bugPenalty = Math.round(project.bugDebt * 0.5);
  const overrun = Math.max(0, project.weeksElapsed - project.weeksTarget);
  const overrunPenalty = overrun * 3;
  const polishBonus = Math.min(polishCount * 2, 6);
  const score = clamp(base - bugPenalty - overrunPenalty + polishBonus, 0, 100);
  return { score, base, bugPenalty, overrunPenalty, polishBonus };
}

/** BALANCE.md 첫 매출 대역 약 150~400 골드. */
function computeRevenue(score: number): number {
  return Math.round(150 + score * 2.5);
}

export function shipProject(prev: GameState, polishCount: number): ReleaseOutcome {
  const r = computeReview(prev, polishCount);
  const stars = computeStars(r.score);
  const revenue = computeRevenue(r.score);
  const released = release(prev);
  const state: GameState = { ...released, gold: released.gold + revenue };
  return {
    reviewScore: r.score,
    stars,
    headline: HEADLINE_BY_STARS[stars],
    revenue,
    breakdown: {
      base: r.base,
      bugPenalty: r.bugPenalty,
      overrunPenalty: r.overrunPenalty,
      polishBonus: r.polishBonus,
    },
    state,
  };
}
