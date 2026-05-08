/**
 * 위기 모먼트 — 시간 제한이 있는 미니 결정.
 * 5초 안에 선택하지 않으면 defaultApply(최악 효과) 자동 발동.
 */
import type { GameState } from './types';

export interface CrisisChoice {
  readonly label: string;
  readonly summary: string;
  readonly apply: (state: GameState) => GameState;
}

export interface Crisis {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** 응답 없을 때 자동 발동되는 최악 효과. */
  readonly defaultApply: (state: GameState) => GameState;
  readonly choices: ReadonlyArray<CrisisChoice>;
  /** 만료 시간(ms). */
  readonly timeoutMs: number;
}

/** clamp 유틸 — 0~100 범위. */
function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export const CRISES: ReadonlyArray<Crisis> = [
  {
    id: 'production-outage',
    title: '프로덕션 장애 발생!',
    description:
      '배포 직후 서버가 다운됐다. 고객 민원이 폭발하고 있다. 빠른 결정이 필요하다.',
    timeoutMs: 5000,
    defaultApply: (state) => ({
      // 무대응 — 별점 위험 (사기 전원 -15, BugDebt +10)
      ...state,
      employees: state.employees.map((e) => ({
        ...e,
        morale: clamp100(e.morale - 15),
      })),
      project: {
        ...state.project,
        bugDebt: Math.min(100, state.project.bugDebt + 10),
      },
    }),
    choices: [
      {
        label: '핫픽스 긴급 배포',
        summary: 'BugDebt +8, gold −100. 빠르게 대응.',
        apply: (state) => ({
          ...state,
          gold: Math.max(0, state.gold - 100),
          project: {
            ...state.project,
            bugDebt: Math.min(100, state.project.bugDebt + 8),
          },
        }),
      },
      {
        label: '이전 버전 롤백',
        summary: 'Progress −10%, 안정성 회복.',
        apply: (state) => ({
          ...state,
          project: {
            ...state.project,
            progress: Math.max(0, state.project.progress - 10),
          },
        }),
      },
      {
        label: '무시하고 넘어간다',
        summary: '전원 morale −15, BugDebt +10. 팀 사기 타격.',
        apply: (state) => ({
          ...state,
          employees: state.employees.map((e) => ({
            ...e,
            morale: clamp100(e.morale - 15),
          })),
          project: {
            ...state.project,
            bugDebt: Math.min(100, state.project.bugDebt + 10),
          },
        }),
      },
    ],
  },
  {
    id: 'security-vuln',
    title: '보안 취약점 제보',
    description:
      '외부 연구자가 치명적인 SQL 인젝션 취약점을 제보했다. 즉각 대응 여부를 결정해야 한다.',
    timeoutMs: 5000,
    defaultApply: (state) => ({
      // 무대응 — 명성 손실 시뮬 (gold −200, BugDebt +8)
      ...state,
      gold: Math.max(0, state.gold - 200),
      project: {
        ...state.project,
        bugDebt: Math.min(100, state.project.bugDebt + 8),
      },
    }),
    choices: [
      {
        label: '즉시 패치 배포',
        summary: 'Progress −5%, gold −50. 신뢰도 유지.',
        apply: (state) => ({
          ...state,
          gold: Math.max(0, state.gold - 50),
          project: {
            ...state.project,
            progress: Math.max(0, state.project.progress - 5),
          },
        }),
      },
      {
        label: '다음 분기에 처리',
        summary: 'BugDebt +5. 위험을 뒤로 미룸.',
        apply: (state) => ({
          ...state,
          project: {
            ...state.project,
            bugDebt: Math.min(100, state.project.bugDebt + 5),
          },
        }),
      },
      {
        label: '공개 무시',
        summary: 'gold −200, BugDebt +8. 최악의 선택.',
        apply: (state) => ({
          ...state,
          gold: Math.max(0, state.gold - 200),
          project: {
            ...state.project,
            bugDebt: Math.min(100, state.project.bugDebt + 8),
          },
        }),
      },
    ],
  },
  {
    id: 'ddos-attack',
    title: 'DDoS 공격!',
    description:
      '대규모 트래픽 공격이 들어오고 있다. 서비스가 불안정하다. 대응 방법을 선택하라.',
    timeoutMs: 5000,
    defaultApply: (state) => ({
      // 무대응 — 전원 사기 타격 + gold 손실
      ...state,
      gold: Math.max(0, state.gold - 150),
      employees: state.employees.map((e) => ({
        ...e,
        morale: clamp100(e.morale - 10),
      })),
    }),
    choices: [
      {
        label: '클라우드 방화벽 비용 지불',
        summary: 'gold −200. 즉각 차단, 안정.',
        apply: (state) => ({
          ...state,
          gold: Math.max(0, state.gold - 200),
        }),
      },
      {
        label: '트래픽 견디기',
        summary: '전원 morale −10. 팀 피로 증가.',
        apply: (state) => ({
          ...state,
          employees: state.employees.map((e) => ({
            ...e,
            morale: clamp100(e.morale - 10),
          })),
        }),
      },
      {
        label: '외부 보안 업체 도움',
        summary: 'gold −100, 전원 stamina −5. 명성 소폭 하락.',
        apply: (state) => ({
          ...state,
          gold: Math.max(0, state.gold - 100),
          employees: state.employees.map((e) => ({
            ...e,
            stamina: clamp100(e.stamina - 5),
          })),
        }),
      },
    ],
  },
];

/** 매주 위기 발동 확률. */
export const CRISIS_TRIGGER_PROBABILITY = 0.05;
/** 위기 발동 최소 작품 수(이 이상부터 발동). */
export const CRISIS_MIN_PRODUCT_COUNT = 3;
/** 마지막 위기 이후 발동 금지 주차. */
export const CRISIS_COOLDOWN_WEEKS = 6;

/** 무작위 위기 1개 반환. CRISES가 비어 있으면 null. */
export function pickCrisis(): Crisis | null {
  if (CRISES.length === 0) return null;
  const idx = Math.floor(Math.random() * CRISES.length);
  return CRISES[idx] ?? null;
}
