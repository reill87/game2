/**
 * 랜덤 이벤트 — Slice 7. 자동 진행 중 매 N주에 발동 후보를 추려 하나를 띄운다.
 * 효과는 모두 순수 함수로 GameState → GameState 변환.
 *
 * v1 카탈로그 6종 — 골드/사기/체력/Progress/BugDebt/Appeal를 다양하게 건드려
 * "다음 주 누르기"의 단조로움을 깬다. 게이팅(canTrigger)으로 상황 어울리지 않는
 * 이벤트는 후보에서 제외한다(예: appealEnabled가 아닐 때 미디어 노출 X).
 */
import type { Employee, GameState } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function applyToAll(state: GameState, fn: (e: Employee) => Employee): GameState {
  return { ...state, employees: state.employees.map(fn) };
}

export interface EventChoice {
  readonly label: string;
  /** 선택 버튼 아래 작은 회색 텍스트 — 비용/효과 미리 보기. */
  readonly summary: string;
  readonly apply: (state: GameState) => GameState;
}

export interface GameEvent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly choices: ReadonlyArray<EventChoice>;
  /** 발동 가능 게이트. 미정의면 항상 후보. */
  readonly canTrigger?: (state: GameState) => boolean;
}

export const EVENTS: ReadonlyArray<GameEvent> = [
  {
    id: 'chicken-party',
    title: '치킨 회식',
    description: '오늘 작업 잘 흘러간 김에, 다 같이 치킨 어떨까. 회식비를 결제하면 모두에게 활력이 돈다.',
    canTrigger: (s) => s.gold >= 30,
    choices: [
      {
        label: '쏜다 (-30g)',
        summary: '모두 사기 +15, 체력 +10',
        apply: (s) =>
          applyToAll(
            { ...s, gold: clamp(s.gold - 30, 0, Number.MAX_SAFE_INTEGER) },
            (e) => ({
              ...e,
              morale: clamp(e.morale + 15, 0, 100),
              stamina: clamp(e.stamina + 10, 0, 100),
            }),
          ),
      },
      {
        label: '오늘은 패스',
        summary: '아무 변화 없음',
        apply: (s) => s,
      },
    ],
  },

  {
    id: 'bug-storm',
    title: '버그 신고 폭주',
    description: '커뮤니티에서 버그 보고가 한꺼번에 들어왔다. 내부에서 처리하면 시간이 들고, 외주를 쓰면 골드가 나간다.',
    choices: [
      {
        label: '내부 처리',
        summary: 'BugDebt +12, 모두 사기 -3',
        apply: (s) =>
          applyToAll(
            { ...s, project: { ...s.project, bugDebt: clamp(s.project.bugDebt + 12, 0, 100) } },
            (e) => ({ ...e, morale: clamp(e.morale - 3, 0, 100) }),
          ),
      },
      {
        label: '외주 처리 (-40g)',
        summary: '골드 차감, BugDebt 변화 없음',
        apply: (s) => ({ ...s, gold: clamp(s.gold - 40, 0, Number.MAX_SAFE_INTEGER) }),
      },
    ],
  },

  {
    id: 'inspiration',
    title: '영감의 순간',
    description: '회의 중 한 명이 결정적인 인사이트를 냈다. 바로 반영하면 진척에 도움이 된다.',
    choices: [
      {
        label: '바로 반영',
        summary: 'Progress +5%, 모두 사기 +5',
        apply: (s) =>
          applyToAll(
            { ...s, project: { ...s.project, progress: clamp(s.project.progress + 5, 0, 100) } },
            (e) => ({ ...e, morale: clamp(e.morale + 5, 0, 100) }),
          ),
      },
      {
        label: '나중에',
        summary: '메모만 남기고 진행',
        apply: (s) => s,
      },
    ],
  },

  {
    id: 'press-coverage',
    title: '미디어 노출',
    description: '인디 매체 한 곳이 우리 작품을 짧게 다뤘다. 광고비를 더 태우면 화제성을 키울 수 있다.',
    canTrigger: (s) => s.project.appealEnabled,
    choices: [
      {
        label: '광고비 추가 (-50g)',
        summary: 'Appeal +8',
        apply: (s) => {
          if (s.gold < 50) return s;
          return {
            ...s,
            gold: clamp(s.gold - 50, 0, Number.MAX_SAFE_INTEGER),
            project: { ...s.project, appeal: clamp(s.project.appeal + 8, 0, 100) },
          };
        },
      },
      {
        label: '본업 집중',
        summary: 'Progress +3%',
        apply: (s) => ({
          ...s,
          project: { ...s.project, progress: clamp(s.project.progress + 3, 0, 100) },
        }),
      },
    ],
  },

  {
    id: 'hardware-fail',
    title: '랩탑 사망',
    description: '한 명의 작업 환경이 갑자기 멈췄다. 새 장비를 바로 사 줄지, 수리 대기시킬지.',
    choices: [
      {
        label: '바로 교체 (-40g)',
        summary: '아무 영향 없음',
        apply: (s) => ({ ...s, gold: clamp(s.gold - 40, 0, Number.MAX_SAFE_INTEGER) }),
      },
      {
        label: '수리 대기',
        summary: '무작위 한 명 사기 -5, 체력 -10',
        apply: (s) => {
          if (s.employees.length === 0) return s;
          const idx = Math.floor(Math.random() * s.employees.length);
          return {
            ...s,
            employees: s.employees.map((e, i) =>
              i === idx
                ? {
                    ...e,
                    morale: clamp(e.morale - 5, 0, 100),
                    stamina: clamp(e.stamina - 10, 0, 100),
                  }
                : e,
            ),
          };
        },
      },
    ],
  },

  {
    id: 'competitor-release',
    title: '경쟁작 출시',
    description: '비슷한 콘셉트의 작품이 막 나왔다. 차별화에 박차를 가할까, 신경 끄고 가던 길로 갈까.',
    choices: [
      {
        label: '차별화 박차',
        summary: 'Progress +6%, BugDebt +5',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            progress: clamp(s.project.progress + 6, 0, 100),
            bugDebt: clamp(s.project.bugDebt + 5, 0, 100),
          },
        }),
      },
      {
        label: '가던 길',
        summary: '모두 사기 -3',
        apply: (s) =>
          applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 3, 0, 100) })),
      },
    ],
  },
];

/** 발동 가능한 후보를 추려 하나를 무작위로 반환. 후보 없으면 null. */
export function pickRandomEvent(state: GameState): GameEvent | null {
  const candidates = EVENTS.filter((e) => !e.canTrigger || e.canTrigger(state));
  if (candidates.length === 0) return null;
  const i = Math.floor(Math.random() * candidates.length);
  return candidates[i] ?? null;
}
