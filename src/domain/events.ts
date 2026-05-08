/**
 * 랜덤 이벤트 — PIVOT-2 (판교 IT 회사 컨셉 1차).
 *
 * 도메인 메커닉(GameState 변환)은 그대로 유지하면서 카피·트리거를 한국 IT
 * 직격으로 교체. 트로프 뱅크([docs/TROPE_BANK.md])의 ⭐ 항목을 우선 변환,
 * 나머지는 후속 PIVOT-2.5에서 보강.
 *
 * 모든 효과는 순수 함수 GameState → GameState. canTrigger 게이트로 어울리지
 * 않는 상황은 후보에서 제외.
 */
import type { Employee, GameState, Job } from './types';

const MAX = Number.MAX_SAFE_INTEGER;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function applyToAll(state: GameState, fn: (e: Employee) => Employee): GameState {
  return { ...state, employees: state.employees.map(fn) };
}

function applyToJob(state: GameState, job: Job, fn: (e: Employee) => Employee): GameState {
  return {
    ...state,
    employees: state.employees.map((e) => (e.job === job ? fn(e) : e)),
  };
}

function avgMorale(s: GameState): number {
  if (s.employees.length === 0) return 100;
  return s.employees.reduce((a, e) => a + e.morale, 0) / s.employees.length;
}

/** 0.7 ~ 1.3 랜덤 곱수 — 같은 선택도 결과가 다르게. */
function jitter(): number {
  return 0.7 + Math.random() * 0.6;
}

/** 정수 효과에 jitter 곱연산 후 round. */
function jit(value: number): number {
  return Math.round(value * jitter());
}

/**
 * stance 기반 분기 적용 헬퍼.
 * progressive 직원은 progEffect, 그 외는 consEffect 적용.
 */
function applyByStance(
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

/** 이벤트 카테고리(11종) — 슬라이스 7. 모달 헤더 일러스트와 매칭. */
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

/** 이벤트 id → 카테고리 매핑. events.ts 본문 섹션 주석과 1:1 대응. */
const EVENT_CATEGORY_BY_ID: Readonly<Record<string, EventCategory>> = {
  'weekend-chat-storm': 'A',
  'short-meeting-trap': 'A',
  'scope-creep-pre-freeze': 'B',
  'okr-quarter': 'B',
  'exec-pt-deck': 'B',
  'k-agile-adoption': 'C',
  'k-devops-transition': 'C',
  'ai-coding-tool': 'C',
  'legacy-found': 'C',
  'stability-quarter': 'C',
  'reorg-quarterly': 'D',
  'flat-org-rename': 'D',
  'new-exec-onboarding': 'D',
  'exit-interview': 'D',
  'quarterly-dinner': 'D',
  'launch-day-traffic': 'E',
  'cs-flood': 'E',
  'series-funding': 'F',
  'trend-shift': 'F',
  'tech-conf-booth': 'F',
  'competitor-release': 'F',
  'friend-team-launch': 'F',
  inspiration: 'G',
  'laptop-died': 'G',
  'laptop-left-overnight': 'H',
  'ceo-only-bug': 'H',
  'pre-launch-prayer': 'H',
  'security-incident': 'I',
  'prod-push-accident': 'I',
  'qa-vs-dev': 'J',
  'progressive-vs-conservative': 'J',
  'team-hoodie': 'K',
  'overdue-panic': 'K',
  'morale-crisis': 'K',
};

export function categoryOf(event: GameEvent): EventCategory {
  return EVENT_CATEGORY_BY_ID[event.id] ?? 'A';
}

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

export const EVENTS: ReadonlyArray<GameEvent> = [
  // ────────── A. 의사소통·메신저 ──────────
  {
    id: 'weekend-chat-storm',
    title: '주말 단톡 폭주',
    description:
      '토요일 오후, 회사 단톡에 빨간 배지가 쌓이고 있다. 임원이 다급한 결정 요청을 던졌다. 답할까, 월요일까지 미룰까.',
    choices: [
      {
        label: '바로 대응',
        // PM 체력 손해 but 임원 신뢰로 골드 보상
        summary: 'PM 체력 −15 / 임원 신뢰 +30g',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(15), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(30), 0, MAX) };
        },
      },
      {
        label: '월요일에 답합니다',
        // 팀 사기 소폭 손해 but PM 충분히 쉬어 체력 회복
        summary: '모두 사기 −3 (단톡 압박 잔영) / PM 체력 +5 (휴식)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) }));
          return applyToJob(next, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(5), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'short-meeting-trap',
    minProductCount: 2,
    title: '"잠깐 시간 되세요?"',
    description: '한 명이 30분만 보겠다고 한 회의가 1시간 50분째 진행 중이다.',
    choices: [
      {
        label: '끝까지 듣는다',
        // 체력 손해 but 팀원 결속으로 사기 소폭 상승
        summary: '모두 체력 −5 / 모두 사기 +3 (끝까지 함께한 연대감)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(5), 0, 100),
            morale: clamp(e.morale + jit(3), 0, 100),
          })),
      },
      {
        label: '"화장실 좀…"하고 빠진다',
        // PM 사기 손해 but 팀원 전원 체력 절약
        summary: 'PM 사기 −5 (남은 사람의 원망) / 모두 체력 +3 (일찍 자리 비움)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return applyToAll(next, (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(3), 0, 100),
          }));
        },
      },
    ],
  },

  // ────────── B. 기획·스코프 ──────────
  {
    id: 'scope-creep-pre-freeze',
    title: '프리징 직전 스코프 추가',
    description:
      '코드 프리징 D-2. BD가 미팅에서 "고객사가 강하게 요청해서…"라며 새 요구사항을 가져왔다.',
    choices: [
      {
        label: '추가 반영',
        // 프로그레스·버그 손해 but 고객사 신뢰로 골드 확보
        summary: 'Progress −5%, BugDebt +6, PM 사기 −3 / 계약 유지 +40g',
        apply: (s) => {
          const next = {
            ...s,
            gold: clamp(s.gold + jit(40), 0, MAX),
            project: {
              ...s.project,
              progress: clamp(s.project.progress - jit(5), 0, 100),
              bugDebt: clamp(s.project.bugDebt + jit(6), 0, 100),
            },
          };
          return applyToJob(next, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
        },
      },
      {
        label: '다음 버전으로',
        // 안전해 보이지만 밀린 일 쌓이고 외주 안 쓴 비용은 절약
        summary: 'BugDebt +3 (밀린 요구사항 압박) / gold +20 (외주 회의 취소 절약)',
        apply: (s) => ({
          ...s,
          gold: clamp(s.gold + jit(20), 0, MAX),
          project: {
            ...s.project,
            bugDebt: clamp(s.project.bugDebt + jit(3), 0, 100),
          },
        }),
      },
    ],
  },
  {
    id: 'okr-quarter',
    minProductCount: 4,
    title: '분기 OKR 작성',
    description:
      'KR 적기 시즌. 모두 노트북 앞에 앉아 "분기 후 회고에서 잘 보일 KR"을 짜고 있다.',
    choices: [
      {
        label: '진지하게 작성',
        // PM 체력 손해 but 팀 방향 정렬로 Progress 소폭 오름
        summary: 'PM 체력 −15 / Progress +2% (팀 방향 정렬)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(15), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              progress: clamp(next.project.progress + jit(2), 0, 100),
            },
          };
        },
      },
      {
        label: '지난 분기 KR 복붙',
        // 시간 아끼지만 팀 냉소 누적
        summary: '모두 사기 −2 (또 그렇게) / PM 체력 +8 (복붙은 빠름)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
          }));
          return applyToJob(next, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(8), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'exec-pt-deck',
    minProductCount: 8,
    title: '임원 PT 자료 요청',
    description: '다음 주 보고용 슬라이드 자료를 만들어 달라는 요청. 100장 정도면 좋겠다고 한다.',
    choices: [
      {
        label: '전 팀이 자료 작업',
        // 모두 체력 손해 but 완성도 높아 임원 신뢰 골드
        summary: '모두 체력 −10 / 임원 신뢰 +25g',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(10), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(25), 0, MAX) };
        },
      },
      {
        label: 'PM 혼자 야간 작업',
        // PM만 체력+사기 손해 but 팀원 집중력 유지로 Progress
        summary: 'PM 체력 −25, 사기 −5 / Progress +2% (팀 방해 없음)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(25), 0, 100),
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              progress: clamp(next.project.progress + jit(2), 0, 100),
            },
          };
        },
      },
    ],
  },

  // ────────── C. 개발·기술 ──────────
  {
    id: 'k-agile-adoption',
    minProductCount: 3,
    title: '에자일 도입 워크샵',
    description:
      '외부 코치를 초청해 에자일 도입 워크샵 진행. 데일리 스탠드업, 회고 다 도입하기로 했다. 한 달 뒤를 기대해 보자.',
    choices: [
      {
        label: '제대로 도입',
        // 골드+시간 비용 but progressive는 skill 상승, conservative는 사기 하락
        summary: '−50g / progressive 개발자 skill +0.05, conservative 직원 사기 −3',
        apply: (s) => {
          if (s.gold < 50) return s;
          const paid = { ...s, gold: clamp(s.gold - 50, 0, MAX) };
          return applyByStance(
            paid,
            (e) =>
              e.job === 'programmer'
                ? { ...e, skill: clamp(e.skill + 0.05, 0, 2) }
                : e,
            (e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) }),
          );
        },
      },
      {
        label: '스탠드업만 도입 (그러다 곧 폐기)',
        // 사기 손해 but 비용 절약 + 일단 짧게 회의해서 체력 미세 절약
        summary: '모두 사기 −3 (또 형식만) / +20g 절약, PM 체력 +3 (짧은 미팅)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
          const recovered = applyToJob(next, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(3), 0, 100),
          }));
          return { ...recovered, gold: clamp(recovered.gold + jit(20), 0, MAX) };
        },
      },
    ],
  },
  {
    id: 'k-devops-transition',
    minProductCount: 6,
    title: 'DevOps 전환 선언',
    description:
      '"앞으로 운영도 개발자가 같이 가져가는 걸로." 인프라 채용은 다음 분기로 미뤘다고 한다.',
    choices: [
      {
        label: '수용',
        // 개발자 체력+사기 손해 but BugDebt 감소(직접 운영)
        summary: '개발자 체력 −8, 사기 −3 / BugDebt −3 (직접 운영으로 품질 향상)',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - jit(3), 0, 100) },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(8), 0, 100),
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
        },
      },
      {
        label: '인프라 채용 강력 요구',
        // PM 사기 상승 but BugDebt 소폭 누적(인프라 공백 지속)
        summary: 'PM 사기 +3 (소신 발언) / BugDebt +4 (인프라 공백 지속)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(3), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt + jit(4), 0, 100),
            },
          };
        },
      },
    ],
  },
  {
    id: 'ai-coding-tool',
    minProductCount: 2,
    title: 'AI 코딩 도구 도입 회의',
    description:
      'Copilot·Cursor 류 도입 검토. 한쪽은 "이미 안 쓰면 손해", 다른 쪽은 "코드 유출은요?". 결정 시간이 왔다.',
    choices: [
      {
        label: '도입 (-30g)',
        // 비용+BugDebt 손해 but 개발자 skill 상승
        summary: '−30g, BugDebt +3 (AI 코드 검증 부담) / 개발자 skill +0.04',
        apply: (s) => {
          if (s.gold < 30) return s;
          const next = {
            ...s,
            gold: clamp(s.gold - 30, 0, MAX),
            project: {
              ...s.project,
              bugDebt: clamp(s.project.bugDebt + jit(3), 0, 100),
            },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            skill: clamp(e.skill + 0.04, 0, 2),
          }));
        },
      },
      {
        label: '보안 검토 후 결정 (= 보류)',
        // 보안 신뢰 유지 but 개발자 답답함으로 사기 소폭 하락
        summary: '개발자 사기 −3 (기다림의 피로) / BugDebt −2 (신중한 도구 선택)',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt - jit(2), 0, 100),
            },
          };
        },
      },
    ],
  },
  {
    id: 'legacy-found',
    minProductCount: 5,
    title: '레거시 코드 발견',
    description:
      '예전 어느 분이 짠 코드. 주석에 "TODO: 정리 필요"가 박혀 있고, 그게 본인이라는 사실이 git blame에서 드러났다.',
    choices: [
      {
        label: '리팩터링 진행',
        // Progress 손해 but BugDebt 크게 감소
        summary: 'Progress −3%, BugDebt −15 / 개발자 사기 +5 (코드 개선 뿌듯함)',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              progress: clamp(s.project.progress - jit(3), 0, 100),
              bugDebt: clamp(s.project.bugDebt - jit(15), 0, 100),
            },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(5), 0, 100),
          }));
        },
      },
      {
        label: '주석 한 줄 더 (// 다음에)',
        // BugDebt 소폭 증가 but 시간 절약으로 Progress 유지
        summary: 'BugDebt +3 / Progress +1% (시간 아낀 만큼 기능 진행)',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            bugDebt: clamp(s.project.bugDebt + jit(3), 0, 100),
            progress: clamp(s.project.progress + jit(1), 0, 100),
          },
        }),
      },
    ],
  },
  {
    id: 'stability-quarter',
    minProductCount: 4,
    title: '"이번 분기는 안정화" 선언',
    description: '임원이 분기 시작에 안정화 선언을 했다. 매번 그랬듯, 이번에도 그럴 것이다.',
    choices: [
      {
        label: '실제로 안정화',
        // 시간 소모 but BugDebt 크게 감소
        summary: '1주 소요, BugDebt −10 / 개발자 사기 +3 (진짜로 했다는 뿌듯함)',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              weeksElapsed: s.project.weeksElapsed + 1,
              bugDebt: clamp(s.project.bugDebt - jit(10), 0, 100),
            },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(3), 0, 100),
          }));
        },
      },
      {
        label: '말만 안정화',
        // 사기 손해 but 기능 개발 계속돼 Progress 소폭 증가
        summary: '모두 사기 −2 (또…) / Progress +2% (기능 개발 계속)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              progress: clamp(next.project.progress + jit(2), 0, 100),
            },
          };
        },
      },
    ],
  },

  // ────────── D. 조직·HR ──────────
  {
    id: 'reorg-quarterly',
    minProductCount: 5,
    title: '분기 조직 개편 통보',
    description:
      '"이번 분기부터 조직이 다음과 같이 재편됩니다." 보고 라인 일부 변경, 팀명 변경. 실체는 같은 사람들.',
    choices: [
      {
        label: '따른다',
        // 적응 사기 손해 but 임원에게 협조적 이미지로 골드 보상
        summary: '모두 사기 −5 (1주 적응) / +30g (협조적 팀 이미지)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(30), 0, MAX) };
        },
      },
      {
        label: 'PM이 대신 항의',
        // PM 사기 큰 손해 but 팀원 사기는 오히려 오름 (PM이 싸워줌)
        summary: 'PM 사기 −10 (혼자 다 맞음) / 팀원 사기 +4 (PM이 지켜줬다)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(10), 0, 100),
          }));
          return {
            ...next,
            employees: next.employees.map((e) =>
              e.job !== 'planner' ? { ...e, morale: clamp(e.morale + jit(4), 0, 100) } : e,
            ),
          };
        },
      },
    ],
  },
  {
    id: 'flat-org-rename',
    minProductCount: 10,
    title: '"전 직급 ㅇㅇ님 통일"',
    description:
      '오늘부터 호칭을 모두 통일한다고 한다. 결정은 그대로 위에서 내려오겠지만 형식은 더 수평적이다.',
    choices: [
      {
        label: '바로 적응',
        // 사기 소폭 상승 but conservative 직원은 혼란
        summary: '모두 사기 +1 (잠깐 농담) / conservative 직원 체력 −3 (혼란)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(1), 0, 100),
          }));
          return applyByStance(
            next,
            (e) => e,
            (e) => ({ ...e, stamina: clamp(e.stamina - jit(3), 0, 100) }),
          );
        },
      },
      {
        label: '그냥 박코더 박과장 둘 다 부른다',
        // 팀원 사기 소폭 하락 but PM 체력 손해 없음 (괜한 적응 에너지 불필요)
        summary: '모두 사기 −2 (어색한 이중 호칭) / PM 체력 +2 (아무것도 바꾸지 않음)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
          }));
          return applyToJob(next, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(2), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'new-exec-onboarding',
    minProductCount: 8,
    title: '신임 임원 합류',
    description:
      '신임 임원이 방금 합류했다. 첫 분기에 대대적인 변화를 예고하고 있다. 모든 정책이 reset 될지 모른다.',
    choices: [
      {
        label: '환영 분위기 맞추기',
        // 팀 사기 손해 but 임원 관계 구축으로 골드 확보
        summary: '모두 사기 −3 (진심 아닌 환영) / +40g (임원 첫인상 관리)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(40), 0, MAX) };
        },
      },
      {
        label: '조용히 본업',
        // 사기 손해 적지만 기능 진행으로 Progress 소폭 오름
        summary: '모두 사기 −2 (눈치 보임) / Progress +2% (본업 집중)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              progress: clamp(next.project.progress + jit(2), 0, 100),
            },
          };
        },
      },
    ],
  },
  {
    id: 'exit-interview',
    minProductCount: 4,
    minReputation: 20,
    title: '퇴사 면담 요청',
    description: '한 직원이 따로 1:1을 요청해 왔다. 평소 사기가 많이 떨어져 있던 사람이다.',
    canTrigger: (s) => avgMorale(s) < 40,
    choices: [
      {
        label: '카운터 오퍼 (-150g)',
        summary: '모두 사기 +15 (분위기 회복) / 골드 압박 −150g',
        apply: (s) => {
          if (s.gold < 150) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 150, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + jit(15), 0, 100) }),
          );
        },
      },
      {
        label: '본인 결정 존중 (= 떠남)',
        // 직원 퇴사 but 남은 팀원 사기 소폭 오름 (퇴사 자유 존중 분위기)
        summary: '가장 사기 낮은 1명 퇴사 / 남은 팀원 사기 +3 (의사 존중)',
        apply: (s) => {
          if (s.employees.length <= 2) return s; // 너무 적으면 보호
          let lowestIdx = 0;
          for (let i = 1; i < s.employees.length; i++) {
            const a = s.employees[i];
            const b = s.employees[lowestIdx];
            if (a && b && a.morale < b.morale) lowestIdx = i;
          }
          const afterLeave = {
            ...s,
            employees: s.employees.filter((_, i) => i !== lowestIdx),
            assignment: Object.fromEntries(
              Object.entries(s.assignment).filter(
                ([, id]) => id !== s.employees[lowestIdx]?.id,
              ),
            ),
          };
          return applyToAll(afterLeave, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(3), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'quarterly-dinner',
    minProductCount: 2,
    title: '분기 회식',
    description: '분기 마감 기념 회식 안내가 단톡에 떴다. "강제 아닙니다" 이모지와 함께.',
    choices: [
      {
        label: '쏜다 (-50g)',
        summary: '모두 사기 +12 / 다음 날 체력 −5',
        apply: (s) => {
          if (s.gold < 50) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 50, 0, MAX) },
            (e) => ({
              ...e,
              morale: clamp(e.morale + jit(12), 0, 100),
              stamina: clamp(e.stamina - jit(5), 0, 100),
            }),
          );
        },
      },
      {
        label: '오늘은 패스',
        // 사기 손해 but 체력 절약 + 비용 절약
        summary: '모두 사기 −2 / 체력 +3 (일찍 귀가), +50g 절약',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
            stamina: clamp(e.stamina + jit(3), 0, 100),
          })),
      },
    ],
  },

  // ────────── E. 출시·운영 ──────────
  {
    id: 'launch-day-traffic',
    minProductCount: 3,
    title: '런칭 직후 트래픽 폭주',
    description:
      '출시 직후 그래프가 가파르게 솟고 있다. 한쪽은 "축하"라고 하고 다른 쪽은 "이거 서버가 견디나?"라고 한다.',
    canTrigger: (s) => s.project.weeksElapsed >= 8,
    choices: [
      {
        label: '비상 대응',
        // 골드+체력 손해 but BugDebt 감소 + 팀 자신감
        summary: '−40g, 개발자 체력 −10, BugDebt −5 / 모두 사기 +5 (위기 돌파)',
        apply: (s) => {
          if (s.gold < 40) return s;
          const next = {
            ...s,
            gold: clamp(s.gold - 40, 0, MAX),
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - jit(5), 0, 100) },
          };
          const afterStamina = applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(10), 0, 100),
          }));
          return applyToAll(afterStamina, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(5), 0, 100),
          }));
        },
      },
      {
        label: '일단 지켜본다',
        // BugDebt 크게 오르지만 비용 절약 + 개발자 체력 유지
        summary: 'BugDebt +8 (장애 위험 ↑) / 개발자 체력 +5 (비상 대응 면함)',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt + jit(8), 0, 100) },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(5), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'cs-flood',
    minProductCount: 2,
    title: 'CS 폭주',
    description: '커뮤니티 게시판에 사용자 문의가 쏟아지고 있다. 백오피스가 미흡해 응답이 늦다.',
    canTrigger: (s) => s.project.bugDebt > 50,
    choices: [
      {
        label: '내부 대응',
        // 체력 손해 but BugDebt 감소 + Appeal 약간 회복
        summary: '모두 체력 −8, BugDebt −5 / Appeal +3 (직접 응대 신뢰)',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              bugDebt: clamp(s.project.bugDebt - jit(5), 0, 100),
              appeal: s.project.appealEnabled
                ? clamp(s.project.appeal + jit(3), 0, 100)
                : s.project.appeal,
            },
          };
          return applyToAll(next, (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(8), 0, 100),
          }));
        },
      },
      {
        label: '외주 응대 (-40g)',
        // 비용 지출+Appeal 손해 but 팀원 체력 보존
        summary: '−40g, Appeal −3 (외주 품질 미흡) / 모두 체력 +5 (CS 부담 없음)',
        apply: (s) => {
          const next = {
            ...s,
            gold: clamp(s.gold - 40, 0, MAX),
            project: {
              ...s.project,
              appeal: clamp(s.project.appeal - jit(3), 0, 100),
            },
          };
          return applyToAll(next, (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(5), 0, 100),
          }));
        },
      },
    ],
  },

  // ────────── F. 외부·산업 ──────────
  {
    id: 'series-funding',
    minProductCount: 6,
    minReputation: 30,
    title: '시리즈 펀딩 라운드',
    description:
      'VC 미팅이 들어왔다. 가치 평가는 좋게 나왔지만, 받으면 다음 분기 KPI 압박이 강해진다.',
    choices: [
      {
        label: '투자 유치 (+200g)',
        summary: '골드 +200 / 모두 사기 −3 (KPI 압박)',
        apply: (s) =>
          applyToAll(
            { ...s, gold: clamp(s.gold + 200, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) }),
          ),
      },
      {
        label: '자체 자금으로 (보수)',
        // 골드 없지만 팀 자율성 유지로 사기 소폭 상승
        summary: '모두 사기 +3 (외압 없음) / BugDebt +4 (인프라 투자 못 함)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(3), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt + jit(4), 0, 100),
            },
          };
        },
      },
    ],
  },
  {
    id: 'trend-shift',
    minProductCount: 3,
    title: '시장 트렌드 변화',
    description:
      '한 분기 사이 업계 분위기가 또 바뀌었다. AI 봄이라느니, 에이전트가 답이라느니. 우리 프로젝트는 어디에 있나.',
    choices: [
      {
        label: '본업 집중',
        // Progress 오르지만 Appeal은 뒤처짐
        summary: 'Progress +3% / Appeal −3 (트렌드 무시한 이미지)',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            progress: clamp(s.project.progress + jit(3), 0, 100),
            appeal: s.project.appealEnabled
              ? clamp(s.project.appeal - jit(3), 0, 100)
              : s.project.appeal,
          },
        }),
      },
      {
        label: '트렌드 살짝 반영',
        // Appeal 오르지만 BugDebt 증가
        summary: 'Appeal +5 (트렌디한 이미지) / BugDebt +5 (빠른 구현 부채)',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            appeal: s.project.appealEnabled
              ? clamp(s.project.appeal + jit(5), 0, 100)
              : s.project.appeal,
            bugDebt: clamp(s.project.bugDebt + jit(5), 0, 100),
          },
        }),
      },
    ],
  },
  {
    id: 'tech-conf-booth',
    minProductCount: 8,
    title: '테크 컨퍼런스 부스 제안',
    description: '대형 테크 컨퍼런스에서 부스 자리 제안. 노출은 크지만 비용도 크다.',
    canTrigger: (s) => s.project.appealEnabled && s.gold >= 80,
    choices: [
      {
        label: '부스 참가 (-80g)',
        // 비용+체력 손해 but Appeal 크게 오름
        summary: '−80g, 모두 체력 −5 (준비 피로) / Appeal +12',
        apply: (s) => {
          const next = {
            ...s,
            gold: clamp(s.gold - 80, 0, MAX),
            project: { ...s.project, appeal: clamp(s.project.appeal + jit(12), 0, 100) },
          };
          return applyToAll(next, (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(5), 0, 100),
          }));
        },
      },
      {
        label: '패스',
        // Appeal 기회 손실은 없지만 경쟁사 대비 인지도 하락
        summary: 'Appeal −4 (경쟁사 대비 노출 부족) / +80g 절약, 체력 소모 없음',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            appeal: s.project.appealEnabled
              ? clamp(s.project.appeal - jit(4), 0, 100)
              : s.project.appeal,
          },
        }),
      },
    ],
  },
  {
    id: 'competitor-release',
    minProductCount: 4,
    title: '경쟁작 출시',
    description: '비슷한 컨셉의 서비스가 막 런칭됐다. 차별화에 박차를 가할까, 신경 끄고 갈까.',
    choices: [
      {
        label: '차별화 박차',
        // Progress 오르지만 BugDebt 증가
        summary: 'Progress +6%, 모두 사기 +3 (자극) / BugDebt +5 (급하게 진행)',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              progress: clamp(s.project.progress + jit(6), 0, 100),
              bugDebt: clamp(s.project.bugDebt + jit(5), 0, 100),
            },
          };
          return applyToAll(next, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(3), 0, 100),
          }));
        },
      },
      {
        label: '가던 길',
        // 사기 손해 but BugDebt 안정적
        summary: '모두 사기 −3 (불안감) / BugDebt −3 (서두르지 않음)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt - jit(3), 0, 100),
            },
          };
        },
      },
    ],
  },
  {
    id: 'friend-team-launch',
    minProductCount: 10,
    title: '친구 팀 런칭',
    description: '친한 다른 팀이 오늘 출시했다. 우리도 자극을 받는다.',
    choices: [
      {
        label: '자축 회식 (-25g)',
        // 비용+체력 손해 but 사기 오름
        summary: '−25g, 체력 −5 / 모두 사기 +10 (자극과 연대)',
        apply: (s) => {
          if (s.gold < 25) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 25, 0, MAX) },
            (e) => ({
              ...e,
              morale: clamp(e.morale + jit(10), 0, 100),
              stamina: clamp(e.stamina - jit(5), 0, 100),
            }),
          );
        },
      },
      {
        label: '신경 안 씀',
        // 사기 손해 but 집중력 유지로 Progress 소폭 오름
        summary: '모두 사기 −5 (자극 무시) / Progress +2% (흔들리지 않음)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              progress: clamp(next.project.progress + jit(2), 0, 100),
            },
          };
        },
      },
    ],
  },

  // ────────── G. 일상 ──────────
  {
    id: 'inspiration',
    title: '영감의 순간',
    description: '회의 중 한 명이 결정적인 인사이트를 냈다. 바로 반영하면 진척에 도움이 된다.',
    choices: [
      {
        label: '바로 반영',
        // Progress+사기 오르지만 BugDebt 소폭 증가 (급하게 구현)
        summary: 'Progress +5%, 모두 사기 +5 / BugDebt +3 (빠른 구현 부채)',
        apply: (s) => {
          const next = applyToAll(
            { ...s, project: { ...s.project, progress: clamp(s.project.progress + jit(5), 0, 100) } },
            (e) => ({ ...e, morale: clamp(e.morale + jit(5), 0, 100) }),
          );
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt + jit(3), 0, 100),
            },
          };
        },
      },
      {
        label: '나중에',
        // 기회 손실 but 현재 안정성 유지 + 메모로 BugDebt 소폭 감소
        summary: '모두 사기 −2 (기회 놓침) / BugDebt −2 (신중한 검토)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt - jit(2), 0, 100),
            },
          };
        },
      },
    ],
  },
  {
    id: 'laptop-died',
    minProductCount: 2,
    title: '랩탑 사망',
    description: '한 명의 작업 환경이 갑자기 멈췄다. 새 장비를 바로 사 줄지, 수리 대기시킬지.',
    choices: [
      {
        label: '바로 교체 (-40g)',
        // 비용 손해 but 해당 직원 사기 크게 오름
        summary: '−40g / 해당 직원 사기 +10 (팀이 챙겨줌), Progress +1%',
        apply: (s) => {
          if (s.employees.length === 0) return s;
          const idx = Math.floor(Math.random() * s.employees.length);
          const paid = { ...s, gold: clamp(s.gold - 40, 0, MAX) };
          const boosted = {
            ...paid,
            employees: paid.employees.map((e, i) =>
              i === idx ? { ...e, morale: clamp(e.morale + jit(10), 0, 100) } : e,
            ),
          };
          return {
            ...boosted,
            project: { ...boosted.project, progress: clamp(boosted.project.progress + jit(1), 0, 100) },
          };
        },
      },
      {
        label: '수리 대기',
        // 비용 절약 but 해당 직원 사기+체력 손해
        summary: '무작위 한 명 사기 −5, 체력 −10 / +40g 절약',
        apply: (s) => {
          if (s.employees.length === 0) return s;
          const idx = Math.floor(Math.random() * s.employees.length);
          return {
            ...s,
            employees: s.employees.map((e, i) =>
              i === idx
                ? {
                    ...e,
                    morale: clamp(e.morale - jit(5), 0, 100),
                    stamina: clamp(e.stamina - jit(10), 0, 100),
                  }
                : e,
            ),
          };
        },
      },
    ],
  },

  // ────────── H. 코미디·민간 신앙 ──────────
  {
    id: 'laptop-left-overnight',
    title: '노트북 두고 퇴근',
    description: '한 명이 노트북을 두고 퇴근했다. 다음날 새벽, 알 수 없는 장애가 발생했다.',
    choices: [
      {
        label: '새벽 수습 (개발자 야간 대응)',
        // 체력 손해 but BugDebt 감소 + 팀 사기 소폭 오름 (빠른 해결)
        summary: '개발자 체력 −15, BugDebt −5 / 모두 사기 +2 (빠른 수습)',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - jit(5), 0, 100) },
          };
          const afterStamina = applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(15), 0, 100),
          }));
          return applyToAll(afterStamina, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(2), 0, 100),
          }));
        },
      },
      {
        label: '아침에 출근해서',
        // 사기+BugDebt 손해 but 개발자 체력 보존
        summary: 'BugDebt +8, 모두 사기 −3 / 개발자 체력 +5 (야간 안 씀)',
        apply: (s) => {
          const next = applyToAll(
            { ...s, project: { ...s.project, bugDebt: clamp(s.project.bugDebt + jit(8), 0, 100) } },
            (e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) }),
          );
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(5), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'ceo-only-bug',
    minProductCount: 4,
    title: '대표님 폰에서만 재현',
    description: '대표가 어제 미팅에서 자기 폰으로 시연했더니 버그가 났다. 회사 내에선 재현이 안 된다.',
    canTrigger: (s) => s.project.bugDebt > 50,
    choices: [
      {
        label: '대표 폰 가져와서 디버깅',
        // 체력 손해 but BugDebt 감소 + 대표 신뢰 회복으로 골드
        summary: '개발자 체력 −12, BugDebt −10 / +20g (대표 신뢰 회복)',
        apply: (s) => {
          const next = {
            ...s,
            gold: clamp(s.gold + jit(20), 0, MAX),
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - jit(10), 0, 100) },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(12), 0, 100),
          }));
        },
      },
      {
        label: '"환경 이슈로 보입니다"',
        // 사기 손해 but 개발자 체력 유지 + BugDebt 그대로
        summary: '모두 사기 −5 (대표 신뢰 ↓) / 개발자 체력 +5 (괜한 디버깅 면함)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(5), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'pre-launch-prayer',
    title: '런칭 직전 기도 메타',
    description: '내일 런칭. 팀 전체가 자기 자리에서 조용히 기도 모드. 누가 케이크를 가져왔다.',
    canTrigger: (s) => s.project.progress >= 90,
    choices: [
      {
        label: '같이 기도',
        // 사기 오르지만 준비 시간 약간 소모
        summary: '모두 사기 +5 / 모두 체력 −2 (케이크 먹고 나른해짐)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(5), 0, 100),
            stamina: clamp(e.stamina - jit(2), 0, 100),
          })),
      },
      {
        label: '마지막 점검 집중',
        // 사기 소폭 손해 but BugDebt 소폭 감소
        summary: '모두 사기 −2 (분위기 깸) / BugDebt −4 (꼼꼼한 마지막 점검)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt - jit(4), 0, 100),
            },
          };
        },
      },
    ],
  },

  // ────────── I. 사고·재해 ──────────
  {
    id: 'security-incident',
    minProductCount: 8,
    minReputation: 40,
    title: '보안 사고 발생',
    description: '운영 로그에서 비정상 접근 시그널이 발견됐다. 일단 대응 회의 소집.',
    canTrigger: (s) => s.project.bugDebt > 40,
    choices: [
      {
        label: '즉시 패치 + 외부 보안 (-80g)',
        summary: '−80g, BugDebt −12, 모두 체력 −8 / Appeal +5 (투명한 대응)',
        apply: (s) => {
          if (s.gold < 80) return s;
          const next = {
            ...s,
            gold: clamp(s.gold - 80, 0, MAX),
            project: {
              ...s.project,
              bugDebt: clamp(s.project.bugDebt - jit(12), 0, 100),
              appeal: s.project.appealEnabled
                ? clamp(s.project.appeal + jit(5), 0, 100)
                : s.project.appeal,
            },
          };
          return applyToAll(next, (e) => ({ ...e, stamina: clamp(e.stamina - jit(8), 0, 100) }));
        },
      },
      {
        label: '내부 자체 패치',
        summary: 'BugDebt −5, 개발자 체력 −15, Appeal −5 / +80g 절약',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              bugDebt: clamp(s.project.bugDebt - jit(5), 0, 100),
              appeal: clamp(s.project.appeal - jit(5), 0, 100),
            },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(15), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'prod-push-accident',
    minProductCount: 5,
    title: '테스트 → PROD 푸시 사고',
    description: '한 명이 환경 변수를 헷갈려 테스트로 의도된 변경이 PROD에 올라갔다. QA가 비어 있을 땐 자주 나온다.',
    canTrigger: (s) => !s.assignment.qa,
    choices: [
      {
        label: '롤백 + 회고',
        // 체력+사기 손해 but BugDebt 감소 + 재발 방지로 skill 소폭 오름
        summary: 'BugDebt −3, 모두 체력 −5, 사기 −3 / 개발자 skill +0.02 (회고 학습)',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - jit(3), 0, 100) },
          };
          const afterAll = applyToAll(next, (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(5), 0, 100),
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
          return applyToJob(afterAll, 'programmer', (e) => ({
            ...e,
            skill: clamp(e.skill + 0.02, 0, 2),
          }));
        },
      },
      {
        label: '핫픽스로 덮기',
        // 빠르지만 BugDebt 증가 + 팀원 사기 소폭 손해 (제대로 안 함)
        summary: 'BugDebt +8 / 모두 체력 +3 (빠르게 해결), 개발자 사기 −3 (찝찝함)',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt + jit(8), 0, 100) },
          };
          const afterAll = applyToAll(next, (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(3), 0, 100),
          }));
          return applyToJob(afterAll, 'programmer', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
        },
      },
    ],
  },

  // ────────── J. 직군·성향 갈등 ──────────
  {
    id: 'qa-vs-dev',
    minProductCount: 3,
    title: 'QA vs 개발',
    description:
      '"이거 우리 환경에선 재현 안 되는데요." "QA에선 무조건 나는데요." 회의실 분위기가 묘하다.',
    canTrigger: (s) =>
      s.employees.some((e) => e.job === 'qa') && s.employees.some((e) => e.job === 'programmer'),
    choices: [
      {
        label: '같이 디버깅',
        // 체력 손해 but BugDebt 감소 + QA·개발 관계 개선
        summary: 'QA·개발자 체력 −10, BugDebt −8 / QA·개발자 사기 +4 (협력 성취감)',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - jit(8), 0, 100) },
          };
          return {
            ...next,
            employees: next.employees.map((e) =>
              e.job === 'qa' || e.job === 'programmer'
                ? {
                    ...e,
                    stamina: clamp(e.stamina - jit(10), 0, 100),
                    morale: clamp(e.morale + jit(4), 0, 100),
                  }
                : e,
            ),
          };
        },
      },
      {
        label: '"환경 차이로 둠"',
        // QA 사기 크게 손해 but 개발자 체력 유지 + 빠른 진행
        summary: 'QA 사기 −10 / 개발자 체력 +3 (분쟁 면함), Progress +1%',
        apply: (s) => {
          const next = applyToJob(s, 'qa', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(10), 0, 100),
          }));
          const afterProg = applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(3), 0, 100),
          }));
          return {
            ...afterProg,
            project: {
              ...afterProg.project,
              progress: clamp(afterProg.project.progress + jit(1), 0, 100),
            },
          };
        },
      },
    ],
  },
  {
    id: 'progressive-vs-conservative',
    minProductCount: 5,
    title: '급진파 vs 보수파 충돌',
    description:
      '신기술 도입을 두고 두 진영이 갈렸다. 결정은 한쪽 손을 들어 줘야 한다.',
    choices: [
      {
        label: '급진파 손 들기',
        // progressive 직원 skill 상승 but conservative 사기 손해 + BugDebt 증가
        summary: 'progressive 직원 skill +0.05 / conservative 직원 사기 −5, BugDebt +3',
        apply: (s) => {
          const next = applyByStance(
            s,
            (e) =>
              e.job === 'programmer'
                ? { ...e, skill: clamp(e.skill + 0.05, 0, 2) }
                : { ...e, morale: clamp(e.morale + jit(3), 0, 100) },
            (e) => ({ ...e, morale: clamp(e.morale - jit(5), 0, 100) }),
          );
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt + jit(3), 0, 100),
            },
          };
        },
      },
      {
        label: '보수파 손 들기',
        // 사기 전반 상승 but progressive 직원은 실망 + 1주 소요
        summary: '모두 사기 +3 / progressive 직원 사기 −5 (실망), 1주 추가 소요',
        apply: (s) => {
          const next = applyToAll(
            {
              ...s,
              project: { ...s.project, weeksElapsed: s.project.weeksElapsed + 1 },
            },
            (e) => ({ ...e, morale: clamp(e.morale + jit(3), 0, 100) }),
          );
          return applyByStance(
            next,
            (e) => ({ ...e, morale: clamp(e.morale - jit(5), 0, 100) }),
            (e) => e,
          );
        },
      },
    ],
  },

  // ────────── K. 문화·일상 ──────────
  {
    id: 'team-hoodie',
    minProductCount: 3,
    title: '후드 팀복 도입 회의',
    description: '"우리도 팀복 하나 만들까요?" 색깔, 로고, 사이즈 조사가 시작된다.',
    choices: [
      {
        label: '제작 진행 (-100g)',
        // 비용 손해 but 사기 오름 + PM 체력 소폭 손해 (조사 피로)
        summary: '−100g, PM 체력 −5 (조사 피로) / 모두 사기 +8 (팀 결속)',
        apply: (s) => {
          if (s.gold < 100) return s;
          const paid = {
            ...s,
            gold: clamp(s.gold - 100, 0, MAX),
          };
          const withMorale = applyToAll(paid, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(8), 0, 100),
          }));
          return applyToJob(withMorale, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(5), 0, 100),
          }));
        },
      },
      {
        label: '다음에 (= 영영 안 만듦)',
        // 사기 손해 but 비용 절약 + 약간의 현실적 생산성
        summary: '모두 사기 −2 / Progress +1% (팀복 회의 없이 집중)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              progress: clamp(next.project.progress + jit(1), 0, 100),
            },
          };
        },
      },
    ],
  },

  // ────────── 조건부 (기존 유지·강화) ──────────
  {
    id: 'overdue-panic',
    minProductCount: 2,
    title: '연체 패닉',
    description: '예정보다 늦어졌다. 외부에서 압박이 들어온다.',
    canTrigger: (s) => s.project.weeksElapsed > s.project.weeksTarget,
    choices: [
      {
        label: '외주 인력 (-50g)',
        // 비용 손해 but BugDebt+Progress 개선
        summary: '−50g, BugDebt −8, Progress +3% / 팀 체력 +3 (부담 분산)',
        apply: (s) => {
          if (s.gold < 50) return s;
          const next = {
            ...s,
            gold: clamp(s.gold - 50, 0, MAX),
            project: {
              ...s.project,
              bugDebt: clamp(s.project.bugDebt - jit(8), 0, 100),
              progress: clamp(s.project.progress + jit(3), 0, 100),
            },
          };
          return applyToAll(next, (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(3), 0, 100),
          }));
        },
      },
      {
        label: '다 같이 야근',
        // 체력 손해 but Progress 오름 + 사기는 연대감으로 소폭 오름
        summary: '모두 체력 −10, Progress +5% / 모두 사기 +2 (같이 버팀)',
        apply: (s) =>
          applyToAll(
            { ...s, project: { ...s.project, progress: clamp(s.project.progress + jit(5), 0, 100) } },
            (e) => ({
              ...e,
              stamina: clamp(e.stamina - jit(10), 0, 100),
              morale: clamp(e.morale + jit(2), 0, 100),
            }),
          ),
      },
    ],
  },
  {
    id: 'morale-crisis',
    minProductCount: 4,
    title: '사기 저하 위기',
    description: '팀 분위기가 가라앉았다. 손 안 쓰면 더 떨어진다.',
    canTrigger: (s) => avgMorale(s) < 40,
    choices: [
      {
        label: '회식 강제 (-30g)',
        // 비용+체력 손해 but 사기 큰 폭 상승
        summary: '−30g, 모두 체력 −5 / 모두 사기 +12',
        apply: (s) => {
          if (s.gold < 30) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 30, 0, MAX) },
            (e) => ({
              ...e,
              morale: clamp(e.morale + jit(12), 0, 100),
              stamina: clamp(e.stamina - jit(5), 0, 100),
            }),
          );
        },
      },
      {
        label: '시간이 약',
        // 사기 소폭 손해 but BugDebt 소폭 감소 (조용히 기술 부채 정리)
        summary: '모두 사기 −3 / BugDebt −4 (조용히 기술 부채 정리)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt - jit(4), 0, 100),
            },
          };
        },
      },
    ],
  },
];

/**
 * 발동 가능한 후보를 추려 하나를 무작위로 반환. 후보 없으면 null.
 * @param recentIds 최근 발동된 이벤트 id 배열(중복 방지용). 가능하면 풀에서 제외.
 */
export function pickRandomEvent(
  state: GameState,
  recentIds: ReadonlyArray<string> = [],
): GameEvent | null {
  const baseEligible = EVENTS.filter((e) => {
    // productCount 게이트: 출시한 제품 수 미달이면 제외
    if (e.minProductCount !== undefined && state.productIndex < e.minProductCount) return false;
    // reputation 게이트: 누적 명성 미달이면 제외
    if (e.minReputation !== undefined && state.reputation < e.minReputation) return false;
    // 기존 canTrigger 게이트 (AND 합성)
    if (e.canTrigger && !e.canTrigger(state)) return false;
    return true;
  });
  if (baseEligible.length === 0) return null;
  // 중복 방지: 최근 발동된 이벤트 제외. 모두 제외되면 fallback으로 풀 전체 사용.
  const recentSet = new Set(recentIds);
  const fresh = baseEligible.filter((e) => !recentSet.has(e.id));
  const eligible = fresh.length > 0 ? fresh : baseEligible;
  const idx = Math.floor(Math.random() * eligible.length);
  return eligible[idx] ?? null;
}
