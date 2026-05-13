import type { Employee, GameState, Job } from '../../domain/types';

export const MAX = Number.MAX_SAFE_INTEGER;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function applyToAll(state: GameState, fn: (e: Employee) => Employee): GameState {
  return { ...state, employees: state.employees.map(fn) };
}

export function applyToJob(state: GameState, job: Job, fn: (e: Employee) => Employee): GameState {
  return {
    ...state,
    employees: state.employees.map((e) => (e.job === job ? fn(e) : e)),
  };
}

export function avgMorale(s: GameState): number {
  if (s.employees.length === 0) return 100;
  return s.employees.reduce((a, e) => a + e.morale, 0) / s.employees.length;
}

/** 0.7 ~ 1.3 랜덤 곱수 — 같은 선택도 결과가 다르게. */
function jitter(): number {
  return 0.7 + Math.random() * 0.6;
}

/** 정수 효과에 jitter 곱연산 후 round. */
export function jit(value: number): number {
  return Math.round(value * jitter());
}

/**
 * stance 기반 분기 적용 헬퍼.
 * progressive 직원은 progEffect, 그 외는 consEffect 적용.
 */
export function applyByStance(
  state: GameState,
  progEffect: (e: Employee) => Employee,
  consEffect: (e: Employee) => Employee,
): GameState {
  return {
    ...state,
    employees: state.employees.map((e) =>
      e.stance === 'progressive' ? progEffect(e) : consEffect(e),
    ),
  };
}

export interface EventChoice {
  readonly label: string;
  readonly summary: string;
  readonly apply: (state: GameState) => GameState;
}

/** 이벤트 카테고리(11종) — 모달 헤더 일러스트와 매칭. */
export type EventCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K';

export const EVENT_CATEGORY_LABEL: Readonly<Record<EventCategory, string>> = {
  A: '의사소통',
  B: '기획·스코프',
  C: '개발·기술',
  D: '조직·HR',
  E: '출시·운영',
  F: '외부·산업',
  G: '일상',
  H: '코미디',
  I: '사고',
  J: '갈등',
  K: '문화',
};

export interface GameEvent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly choices: ReadonlyArray<EventChoice>;
  readonly canTrigger?: (state: GameState) => boolean;
  /** 이 시점 이전엔 풀에 안 들어감(=pickRandomEvent 후보 제외). productCount 기준. */
  readonly minProductCount?: number;
  /** 명성 게이트 — reputation 누적이 이 값 이상이어야 풀에 들어감. */
  readonly minReputation?: number;
}

export interface ContentGameEvent extends GameEvent {
  readonly category: EventCategory;
}
