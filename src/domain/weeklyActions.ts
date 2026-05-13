/**
 * 주간 액션 포인트(AP) 시스템.
 * 매주 AP 1개 지급(최대 3 누적). 플레이어가 능동적 결정을 할 수 있도록 5종 액션 제공.
 */
import type { Employee, GameState } from './types';
import { addProjectSignals } from './projectSignals';

export type WeeklyActionId =
  | 'team-meeting'   // 팀 회의
  | 'one-on-one'     // 1:1 면담
  | 'lounge'         // 휴게실 휴식
  | 'daily-standup'  // 데일리 스탠드업
  | 'tech-review';   // 기술 리뷰

export interface WeeklyAction {
  readonly id: WeeklyActionId;
  readonly label: string;
  readonly desc: string;
  readonly apCost: number;
  readonly apply: (state: GameState) => GameState;
}

/** clamp 유틸 — 0~100 범위 고정. */
function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** 모든 직원의 morale/stamina를 delta만큼 조정. */
function applyAllEmployees(
  state: GameState,
  dMorale: number,
  dStamina: number,
): GameState {
  return {
    ...state,
    employees: state.employees.map((e) => ({
      ...e,
      morale: clamp100(e.morale + dMorale),
      stamina: clamp100(e.stamina + dStamina),
    })),
  };
}

/** 가장 사기가 낮은 직원 id 반환. 직원이 없으면 null. */
function lowestMoraleEmpId(employees: ReadonlyArray<Employee>): string | null {
  let minMorale = Infinity;
  let result: string | null = null;
  for (const e of employees) {
    if (e.morale < minMorale) {
      minMorale = e.morale;
      result = e.id;
    }
  }
  return result;
}

export const WEEKLY_ACTIONS: ReadonlyArray<WeeklyAction> = [
  {
    id: 'team-meeting',
    label: '전략 회의',
    desc: '경쟁작·시장 포지셔닝 점검. 전원 morale +5, 시장·창의 상승.',
    apCost: 1,
    apply: (state) => addProjectSignals(applyAllEmployees(state, 5, -3), { market: 1.8, creative: 1.0, ux: 0.4 }, 0.9),
  },
  {
    id: 'one-on-one',
    label: '1:1 면담',
    desc: '사기 최저 직원 morale +15, stamina −5. UX 감수성 소폭 상승.',
    apCost: 1,
    apply: (state) => {
      const targetId = lowestMoraleEmpId(state.employees);
      if (!targetId) return state;
      const next = {
        ...state,
        employees: state.employees.map((e) =>
          e.id === targetId
            ? { ...e, morale: clamp100(e.morale + 15), stamina: clamp100(e.stamina - 5) }
            : e,
        ),
      };
      return addProjectSignals(next, { ux: 0.8 }, 0.3);
    },
  },
  {
    id: 'lounge',
    label: '휴게실 휴식',
    desc: '전원 stamina +8. 창의성 소폭 상승.',
    apCost: 1,
    apply: (state) => addProjectSignals(applyAllEmployees(state, 0, 8), { creative: 1.0 }, 0.4),
  },
  {
    id: 'daily-standup',
    label: '데일리 스탠드업',
    desc: 'BugDebt −4, 전원 stamina −1. 기술·시장 정렬.',
    apCost: 1,
    apply: (state) => {
      const base = applyAllEmployees(state, 0, -1);
      const next = {
        ...base,
        project: {
          ...base.project,
          bugDebt: Math.max(0, base.project.bugDebt - 4),
        },
      };
      return addProjectSignals(next, { tech: 1.0, market: 0.6 }, 0.5);
    },
  },
  {
    id: 'tech-review',
    label: '기술 리뷰',
    desc: '정배치 직원 skill +0.05, BugDebt −3, 기술력 상승.',
    apCost: 1,
    apply: (state) => {
      // 정배치된 직원의 skill을 소폭 올림
      const assignedIds = new Set(Object.values(state.assignment).filter(Boolean) as string[]);
      const next = {
        ...state,
        employees: state.employees.map((e) =>
          assignedIds.has(e.id) ? { ...e, skill: e.skill + 0.05 } : e,
        ),
        project: {
          ...state.project,
          bugDebt: Math.max(0, state.project.bugDebt - 3),
        },
      };
      return addProjectSignals(next, { tech: 2.0 }, 0.5);
    },
  },
];

/** 매주 지급되는 AP. */
export const AP_PER_WEEK = 1;
/** AP 최대 누적 한도. */
export const AP_CAP = 3;
