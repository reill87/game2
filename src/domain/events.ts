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
  // A 신규
  'slack-overload': 'A',
  'email-marathon': 'A',
  'linkedin-headhunt': 'A',
  'scope-creep-pre-freeze': 'B',
  'okr-quarter': 'B',
  'exec-pt-deck': 'B',
  // B 신규
  'pm-rotation': 'B',
  'feature-creep': 'B',
  'k-agile-adoption': 'C',
  'k-devops-transition': 'C',
  'ai-coding-tool': 'C',
  'legacy-found': 'C',
  'stability-quarter': 'C',
  // C 신규
  'tech-debt-month': 'C',
  'migration-rust': 'C',
  'oss-contribute': 'C',
  'reorg-quarterly': 'D',
  'flat-org-rename': 'D',
  'new-exec-onboarding': 'D',
  'exit-interview': 'D',
  'quarterly-dinner': 'D',
  // D 신규
  'culture-survey': 'D',
  'mandatory-csr': 'D',
  'town-hall-q': 'D',
  'launch-day-traffic': 'E',
  'cs-flood': 'E',
  // E 신규
  'media-coverage': 'E',
  'app-store-feature': 'E',
  'series-funding': 'F',
  'trend-shift': 'F',
  'tech-conf-booth': 'F',
  'competitor-release': 'F',
  'friend-team-launch': 'F',
  // F 신규
  'acquisition-offer': 'F',
  'regulator-audit': 'F',
  'industry-award': 'F',
  inspiration: 'G',
  'laptop-died': 'G',
  // G 신규
  'lunch-survey': 'G',
  'book-club': 'G',
  'laptop-left-overnight': 'H',
  'ceo-only-bug': 'H',
  'pre-launch-prayer': 'H',
  // H 신규
  'office-pet': 'H',
  'team-building-pajama': 'H',
  'security-incident': 'I',
  'prod-push-accident': 'I',
  // I 신규
  'data-breach-rumor': 'I',
  'qa-vs-dev': 'J',
  'progressive-vs-conservative': 'J',
  'team-hoodie': 'K',
  'overdue-panic': 'K',
  'morale-crisis': 'K',
  // K 신규
  'dress-code-debate': 'K',
  'english-name': 'K',
  'friday-half-day': 'K',
  // ── 30개 신규 이벤트 ──
  'crisis-pr-instagram': 'A',
  'k-twitter-x-rumor': 'A',
  'open-banking': 'A',
  'dev-internal-blog': 'A',
  'bug-bounty': 'C',
  'compliance-audit-eu': 'C',
  'crashed-ec2': 'I',
  'database-corruption': 'I',
  'series-c-failed': 'F',
  'patent-troll': 'F',
  'github-star-50k': 'F',
  'foreign-vc-visit': 'F',
  'antitrust-investigation': 'F',
  'ipo-roadshow': 'F',
  'q4-bonus-cut': 'D',
  'parental-leave-policy': 'D',
  'unionization-talk': 'D',
  'industry-poach-attempt': 'D',
  'mentor-monday': 'K',
  'pet-policy-vote': 'K',
  'work-from-anywhere': 'E',
  'side-project-policy': 'E',
  'company-retreat-jeju': 'E',
  'sxsw-keynote': 'F',
  'dev-conf-keynote': 'C',
  'ai-debate-summit': 'B',
  'tech-magazine-cover': 'G',
  'design-award': 'G',
  'github-octocat-pin': 'H',
  'former-employee-startup': 'H',
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

  // ────────── A 신규 ──────────
  {
    id: 'slack-overload',
    minProductCount: 5,
    title: '슬랙 채널 100개 돌파',
    description:
      '슬랙 채널 목록을 스크롤해도 끝이 없다. #랜덤, #점심추천, #회의록-복붙 채널까지. 정리가 필요한 때가 온 것 같다.',
    choices: [
      {
        label: '채널 정리 작업 (PM 주도)',
        // PM 체력 손해 but 모두 사기 소폭 오름 (깔끔해짐)
        summary: 'PM 체력 −20 / 모두 사기 +5 (깔끔해진 채널)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(20), 0, 100),
          }));
          return applyToAll(next, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(5), 0, 100),
          }));
        },
      },
      {
        label: '그냥 두기 (각자 알아서)',
        // 모두 체력 소폭 손해 but 사기는 자유로움으로 소폭 유지
        summary: '모두 체력 −3 (알림 피로) / 모두 사기 +3 (자율적 분위기)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(3), 0, 100),
            morale: clamp(e.morale + jit(3), 0, 100),
          })),
      },
    ],
  },
  {
    id: 'email-marathon',
    minProductCount: 8,
    title: '100통 이메일 마라톤',
    description:
      '외부 파트너사 협의 건으로 이메일이 폭주 중이다. 받은 편지함이 미확인 99+를 넘겼다. 한 번에 처리할까, 위임할까.',
    choices: [
      {
        label: '한 방에 몰아서 답장 (PM 직접)',
        // PM 체력 손해 but 빠른 해결로 골드 확보
        summary: 'PM 체력 −15 / gold +30 (빠른 파트너 신뢰)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(15), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(30), 0, MAX) };
        },
      },
      {
        label: '팀원에게 위임',
        // 모두 체력 소폭 손해 but PM 사기 오름 (임파워먼트)
        summary: '모두 체력 −5 (위임받은 부담) / PM 사기 +10 (내려놓기의 해방감)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(5), 0, 100),
          }));
          return applyToJob(next, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(10), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'linkedin-headhunt',
    minProductCount: 12,
    minReputation: 80,
    title: '헤드헌터 DM 폭탄',
    description:
      '링크드인 DM이 연일 온다. 대기업, 스타트업, 해외 포지션까지. 팀원들도 슬쩍 눈치채고 있다.',
    choices: [
      {
        label: '모두 무시하고 집중',
        // 사기 소폭 오름 (충성 느낌)
        summary: '모두 사기 +3 (우리 팀이 최고)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(3), 0, 100),
          })),
      },
      {
        label: '협상 카드로 활용 (연봉 재협상)',
        // 모두 사기 손해 (긴장감) but 골드 확보 (예산 조정 결과)
        summary: '모두 사기 −5 (불안한 협상 분위기) / gold +200 (처우 개선 예산)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(200), 0, MAX) };
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

  // ────────── B 신규 ──────────
  {
    id: 'pm-rotation',
    minProductCount: 10,
    title: 'PM 순환제 도입 논의',
    description:
      '"PM도 돌아가며 해야 다 성장한다"는 의견이 올라왔다. 기존 PM은 좋아하지 않는다.',
    choices: [
      {
        label: '순환제 도입',
        // PM 체력 손해 but 다른 직원 skill 소폭 오름
        summary: 'PM 체력 −15 / 다른 직원 skill +0.05 (업무 다양성)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(15), 0, 100),
          }));
          return {
            ...next,
            employees: next.employees.map((e) =>
              e.job !== 'planner' ? { ...e, skill: clamp(e.skill + 0.05, 0, 2) } : e,
            ),
          };
        },
      },
      {
        label: '현 PM 체제 유지',
        // PM 사기 오름 but 모두 사기 소폭 손해 (다양성 기회 박탈)
        summary: 'PM 사기 +10 (역할 지킴) / 모두 사기 −2 (변화 기회 잃음)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(10), 0, 100),
          }));
          return applyToAll(next, (e) =>
            e.job !== 'planner' ? { ...e, morale: clamp(e.morale - jit(2), 0, 100) } : e,
          );
        },
      },
    ],
  },
  {
    id: 'feature-creep',
    minProductCount: 15,
    title: '기능 폭증의 날',
    description:
      '스프린트 중반인데 기능 요청이 쏟아졌다. 디자이너는 신난 것 같다. 개발자는 벌써 지쳐 보인다.',
    choices: [
      {
        label: '다 넣는다 (디자이너 좋아함)',
        // Progress+BugDebt 손해 but 디자이너 사기 오름
        summary: 'Progress −10%, BugDebt +12 / 디자이너 사기 +8 (마음껏 설계)',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              progress: clamp(s.project.progress - jit(10), 0, 100),
              bugDebt: clamp(s.project.bugDebt + jit(12), 0, 100),
            },
          };
          return applyToJob(next, 'designer', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(8), 0, 100),
          }));
        },
      },
      {
        label: 'MVP 고수 (디자이너 아쉬워함)',
        // 디자이너 사기 손해 but 골드 절약 + 안정적 개발
        summary: '디자이너 사기 −5 (아쉬움) / gold +50 (불필요 개발 비용 절약)',
        apply: (s) => {
          const next = applyToJob(s, 'designer', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(50), 0, MAX) };
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

  // ────────── C 신규 ──────────
  {
    id: 'tech-debt-month',
    minProductCount: 8,
    title: '기술 부채 청산 캠페인',
    description:
      '분기 시작에 "이번엔 진짜로"라는 말이 나왔다. 한 달을 통째로 기술 부채에 쏟을지, 일부만 할지.',
    choices: [
      {
        label: '한 달 통째로 부채 청산',
        // Progress 크게 손해 but BugDebt 크게 감소
        summary: 'Progress −15% / BugDebt −20 (진짜로 했다)',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            progress: clamp(s.project.progress - jit(15), 0, 100),
            bugDebt: clamp(s.project.bugDebt - jit(20), 0, 100),
          },
        }),
      },
      {
        label: '일부만 (스프린트 20% 할당)',
        // BugDebt 소폭 감소 + 사기 소폭 오름 (현실적 타협)
        summary: 'BugDebt −5 / 모두 사기 +3 (현실적인 목표)',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              bugDebt: clamp(s.project.bugDebt - jit(5), 0, 100),
            },
          };
          return applyToAll(next, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(3), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'migration-rust',
    minProductCount: 15,
    minReputation: 100,
    title: 'Rust 마이그레이션 제안',
    description:
      '개발자 한 명이 "Rust로 마이그레이션하면 성능이 10배"라는 슬라이드 20장을 준비해왔다. 눈빛이 반짝인다.',
    choices: [
      {
        label: '가즈아 (Rust로 전환)',
        // 개발자 skill 오름 but BugDebt 증가 + 사기 손해 (학습 곡선)
        summary: '개발자 skill +0.1 / BugDebt +10, 개발자 사기 −5 (학습 고통)',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              bugDebt: clamp(s.project.bugDebt + jit(10), 0, 100),
            },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            skill: clamp(e.skill + 0.1, 0, 2),
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
        },
      },
      {
        label: 'Java 유지 (현실적 선택)',
        // 개발자 사기 오름 + 골드 절약
        summary: '개발자 사기 +8 (안도감) / gold +50 (마이그레이션 비용 절약)',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(8), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(50), 0, MAX) };
        },
      },
    ],
  },
  {
    id: 'oss-contribute',
    minProductCount: 10,
    title: '오픈소스 컨트리뷰션 제안',
    description:
      '개발자들이 사용 중인 오픈소스 라이브러리에 PR을 올리고 싶다고 한다. 회사 시간에 해도 될까.',
    choices: [
      {
        label: '회사 시간 허용 (공식 활동)',
        // 모두 사기 오름 but Progress 소폭 손해
        summary: '모두 사기 +10 (회사가 지원해줌) / Progress −5% (업무 시간 분산)',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              progress: clamp(s.project.progress - jit(5), 0, 100),
            },
          };
          return applyToAll(next, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(10), 0, 100),
          }));
        },
      },
      {
        label: '개인 시간에 (업무 외)',
        // 개발자 사기 손해 but BugDebt 소폭 감소 (자발적 역량 강화)
        summary: '개발자 사기 −5 (회사 지원 없음) / BugDebt −3 (역량 강화 효과)',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
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

  // ────────── D 신규 ──────────
  {
    id: 'culture-survey',
    minProductCount: 8,
    title: '문화 설문 결과 공유 회의',
    description:
      '익명 문화 설문 결과가 나왔다. 불편한 숫자들이 슬라이드에 가득하다. PM이 발표자다.',
    choices: [
      {
        label: '솔직하게 공유 (불편해도)',
        // PM 사기 손해 but 다른 모두 사기 오름 (신뢰 상승)
        summary: 'PM 사기 −5 (현장 화살받이) / 다른 직원 사기 +8 (투명한 문화)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return {
            ...next,
            employees: next.employees.map((e) =>
              e.job !== 'planner' ? { ...e, morale: clamp(e.morale + jit(8), 0, 100) } : e,
            ),
          };
        },
      },
      {
        label: '칭찬 위주로 편집 (선택적 공유)',
        // 모두 사기 소폭 오름 but reputation 손해 (다음 설문에서 냉소 누적)
        summary: '모두 사기 +3 (분위기 좋음) / reputation −5 (냉소 누적)',
        apply: (s) =>
          applyToAll(
            { ...s, reputation: clamp(s.reputation - 5, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + jit(3), 0, 100) }),
          ),
      },
    ],
  },
  {
    id: 'mandatory-csr',
    minProductCount: 12,
    minReputation: 60,
    title: '의무 봉사활동 공지',
    description:
      '회사에서 분기별 의무 사회공헌 활동 참여를 공지했다. 참여할까, 면제 신청을 넣을까.',
    choices: [
      {
        label: '다 같이 참여',
        // 모두 체력 손해 but 사기 소폭 오름 (의미 있는 경험)
        summary: '모두 체력 −10 / 모두 사기 +5 (뜻 깊은 하루)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(10), 0, 100),
            morale: clamp(e.morale + jit(5), 0, 100),
          })),
      },
      {
        label: 'PM이 면제 신청 처리',
        // PM 체력 손해 (서류 처리) + 모두 사기 소폭 손해
        summary: 'PM 체력 −10 (면제 신청 처리) / 모두 사기 −3 (의무 빼기 찜찜함)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(10), 0, 100),
          }));
          return applyToAll(next, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'town-hall-q',
    minProductCount: 15,
    title: '타운홀 Q&A 시간',
    description:
      '전사 타운홀에서 Q&A가 시작됐다. 팀원이 꽤 날카로운 질문을 던졌다. PM이 마이크를 잡았다.',
    choices: [
      {
        label: '직설적으로 답변',
        // 모두 사기 크게 오름 but PM 사기 손해 (뒤탈)
        summary: '모두 사기 +12 (통쾌한 답변) / PM 사기 −10 (뒤탈 각오)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(12), 0, 100),
          }));
          return applyToJob(next, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(10), 0, 100),
          }));
        },
      },
      {
        label: '외교적으로 돌려 말하기',
        // PM 사기 오름 but 모두 사기 소폭 손해 (실망)
        summary: 'PM 사기 +5 (안전한 답변) / 모두 사기 −3 (또 저러네)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(5), 0, 100),
          }));
          return applyToAll(next, (e) =>
            e.job !== 'planner' ? { ...e, morale: clamp(e.morale - jit(3), 0, 100) } : e,
          );
        },
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

  // ────────── E 신규 ──────────
  {
    id: 'media-coverage',
    minProductCount: 10,
    minReputation: 70,
    title: '언론 인터뷰 요청',
    description:
      '테크 미디어에서 우리 서비스 인터뷰를 요청해 왔다. 노출은 크지만 PM이 다 준비해야 한다.',
    choices: [
      {
        label: '인터뷰 응한다',
        // PM 체력 손해 but 골드 + reputation 오름
        summary: 'PM 체력 −15 / gold +150, reputation +5 (브랜드 노출)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(15), 0, 100),
          }));
          return {
            ...next,
            gold: clamp(next.gold + jit(150), 0, MAX),
            reputation: clamp(next.reputation + 5, 0, MAX),
          };
        },
      },
      {
        label: '거절하고 개발 집중',
        // 모두 사기 소폭 손해 but Progress 오름
        summary: '모두 사기 −2 (기회 포기) / Progress +5% (인터뷰 없이 집중)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              progress: clamp(next.project.progress + jit(5), 0, 100),
            },
          };
        },
      },
    ],
  },
  {
    id: 'app-store-feature',
    minProductCount: 12,
    title: '앱스토어 피쳐드 기회',
    description:
      '앱스토어 에디터가 연락해 왔다. 마케팅을 강화하면 피쳐드 될 수 있다. 지금 당장 투자할까.',
    choices: [
      {
        label: '마케팅 강화 (-200g)',
        // 비용 지출 but 골드 큰 폭 획득 (피쳐드 효과)
        summary: '−200g / gold +400 (피쳐드 매출 효과)',
        apply: (s) => {
          if (s.gold < 200) return s;
          return { ...s, gold: clamp(s.gold - 200 + jit(400), 0, MAX) };
        },
      },
      {
        label: '그냥 둔다',
        // 모두 사기 소폭 오름 (부담 없음)
        summary: '모두 사기 +3 (마케팅 압박 없음)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(3), 0, 100),
          })),
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

  // ────────── F 신규 ──────────
  {
    id: 'acquisition-offer',
    minProductCount: 15,
    minReputation: 120,
    title: '스타트업 인수 제안 (우리가 인수자)',
    description:
      '작은 스타트업 팀에서 인수 합병 제안이 들어왔다. 기술력은 있지만 팀 통합 비용이 만만치 않다.',
    choices: [
      {
        label: '제안 거절 (독립 유지)',
        // 모두 사기 오름 + reputation 오름 (독립성 유지)
        summary: '모두 사기 +10 / reputation +10 (독자 노선 신뢰)',
        apply: (s) =>
          applyToAll(
            { ...s, reputation: clamp(s.reputation + 10, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + jit(10), 0, 100) }),
          ),
      },
      {
        label: '협상 테이블만 앉아보기',
        // PM 체력 손해 but 골드 획득 (협상 가치 공유)
        summary: 'PM 체력 −10 (협상 피로) / gold +500 (협상 합의금)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(10), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(500), 0, MAX) };
        },
      },
    ],
  },
  {
    id: 'regulator-audit',
    minProductCount: 18,
    title: '규제기관 감사 통보',
    description:
      '개인정보보호위원회에서 감사 통보가 왔다. 협조하거나 법무 대응하거나.',
    choices: [
      {
        label: '전면 협조 (자료 제출)',
        // PM 체력 크게 손해 but BugDebt 소폭 증가 (서류 준비 부담)
        summary: 'PM 체력 −20 (서류 작업) / BugDebt +5 (급한 취약점 패치)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(20), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt + jit(5), 0, 100),
            },
          };
        },
      },
      {
        label: '법무 대리인 선임 (-300g)',
        // 골드 손해 + 모두 사기 손해 (긴장감)
        summary: '−300g / 모두 사기 −3 (감사 긴장감)',
        apply: (s) => {
          if (s.gold < 300) return s;
          const next = { ...s, gold: clamp(s.gold - 300, 0, MAX) };
          return applyToAll(next, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'industry-award',
    minProductCount: 15,
    minReputation: 100,
    title: '업계 어워드 노미네이트',
    description:
      '올해의 혁신 서비스 어워드에 우리가 올랐다. 시상식 참여가 필요하다.',
    choices: [
      {
        label: '시상식 참석',
        // PM 체력 손해 but reputation 크게 오름
        summary: 'PM 체력 −15 (참석 준비) / reputation +15 (업계 인지도)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(15), 0, 100),
          }));
          return { ...next, reputation: clamp(next.reputation + 15, 0, MAX) };
        },
      },
      {
        label: '개발에 집중 (시상식 불참)',
        // PM 사기 손해 but Progress 오름
        summary: 'PM 사기 −5 (아쉬움) / Progress +8% (집중 개발)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              progress: clamp(next.project.progress + jit(8), 0, 100),
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

  // ────────── G 신규 ──────────
  {
    id: 'lunch-survey',
    minProductCount: 3,
    title: '점심 메뉴 설문',
    description:
      '총무팀에서 사내 점심 설문을 돌렸다. 새 식당 도입이냐, 기존 유지냐. 이게 왜 이렇게 진지한 분위기지.',
    choices: [
      {
        label: '새 식당 도입 (-20g)',
        // 비용 지출 but 모두 사기 오름
        summary: '−20g / 모두 사기 +5 (새 선택지 생김)',
        apply: (s) => {
          if (s.gold < 20) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 20, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + jit(5), 0, 100) }),
          );
        },
      },
      {
        label: '기존 유지 (경비 절감)',
        // 비용 절약 but 모두 사기 소폭 손해
        summary: '모두 사기 −2 (또 그 메뉴) / gold +10 (경비 절감)',
        apply: (s) =>
          applyToAll(
            { ...s, gold: clamp(s.gold + jit(10), 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale - jit(2), 0, 100) }),
          ),
      },
    ],
  },
  {
    id: 'book-club',
    minProductCount: 8,
    title: '사내 독서모임 창설',
    description:
      '"이번 달 책 골랐어요" 메시지와 함께 독서모임 채널이 생겼다. 참여할까, 정중히 패스할까.',
    choices: [
      {
        label: '독서모임 운영 참여',
        // 체력 소폭 손해 but 모두 사기 오름
        summary: '모두 사기 +8 / 모두 체력 −3 (모임 준비 피로)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(8), 0, 100),
            stamina: clamp(e.stamina - jit(3), 0, 100),
          })),
      },
      {
        label: '패스 (업무가 바빠서)',
        // 개발자 사기 손해 + 골드 절약 (도서 구매비)
        summary: '개발자 사기 −3 (참여 못 함) / gold +20 (도서 구매비 절약)',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(20), 0, MAX) };
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

  // ────────── H 신규 ──────────
  {
    id: 'office-pet',
    minProductCount: 10,
    title: '사무실 반려견 등장',
    description:
      '임원이 강아지를 데려왔다. 팀원 절반은 좋아하고 절반은 알레르기다. 어떻게 할까.',
    choices: [
      {
        label: '환영 (마스코트로 삼기)',
        // 모두 사기 크게 오름 but BugDebt 소폭 증가 (집중력 저하)
        summary: '모두 사기 +10 (귀여운 동료) / BugDebt +3 (집중력 분산)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(10), 0, 100),
          }));
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
        label: '정중히 거절 (알레르기 배려)',
        // PM 사기 손해 but BugDebt 소폭 감소 (집중력 유지)
        summary: 'PM 사기 −10 (임원 눈치) / BugDebt −2 (집중 환경 유지)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(10), 0, 100),
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
    id: 'team-building-pajama',
    minProductCount: 12,
    title: '잠옷 팀빌딩 행사',
    description:
      '"이번 팀빌딩 드레스코드는 잠옷입니다." 채널에 혼돈이 왔다. 동참할까, 정장 출근할까.',
    choices: [
      {
        label: '잠옷 입고 동참',
        // 모두 사기 크게 오름 but 체력 소폭 손해 (흥분 피로)
        summary: '모두 사기 +12 (유대감 최고) / 모두 체력 −5 (흥분 피로)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(12), 0, 100),
            stamina: clamp(e.stamina - jit(5), 0, 100),
          })),
      },
      {
        label: '정장으로 출근 (나만의 드레스코드)',
        // 모두 사기 손해 + PM 사기 소폭 오름 (고집 관철)
        summary: '모두 사기 −5 (분위기 깸) / PM 사기 +5 (나만의 스타일)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return applyToJob(next, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(5), 0, 100),
          }));
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

  // ────────── I 신규 ──────────
  {
    id: 'data-breach-rumor',
    minProductCount: 15,
    minReputation: 80,
    title: '데이터 유출 루머 확산',
    description:
      '온라인 커뮤니티에 우리 서비스 데이터가 유출됐다는 글이 올라왔다. 확인되지 않은 루머지만 확산 중이다.',
    choices: [
      {
        label: '즉시 공식 부인 성명 발표',
        // PM 체력 손해 but reputation 소폭 오름 (투명성)
        summary: 'PM 체력 −15 (대응 작업) / reputation +3 (투명한 대응)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(15), 0, 100),
          }));
          return { ...next, reputation: clamp(next.reputation + 3, 0, MAX) };
        },
      },
      {
        label: '일단 무시 (잠잠해지길 기다림)',
        // 모두 사기 손해 + reputation 크게 손해
        summary: '모두 사기 −5 (불안감) / reputation −10 (루머 방치)',
        apply: (s) =>
          applyToAll(
            { ...s, reputation: clamp(s.reputation - 10, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale - jit(5), 0, 100) }),
          ),
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
    id: 'dress-code-debate',
    minProductCount: 8,
    title: '복장 자율화 논쟁',
    description:
      '"슬리퍼가 허용이에요?" 오피스 복장 자율화 논쟁이 점심 대화에서 전사 이슈로 번졌다.',
    choices: [
      {
        label: '완전 자율화',
        // 모두 사기 오름 but 체력 소폭 손해 (의외로 피곤한 자유)
        summary: '모두 사기 +5 (자율 분위기) / 모두 체력 −2 (선택 피로)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(5), 0, 100),
            stamina: clamp(e.stamina - jit(2), 0, 100),
          })),
      },
      {
        label: '가이드라인 배포 (자유지만 기준 있음)',
        // 모두 사기 소폭 손해 but BugDebt 소폭 감소 (안정감)
        summary: '모두 사기 −3 (또 규정) / BugDebt −2 (질서 있는 안정감)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
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
    id: 'english-name',
    minProductCount: 12,
    minReputation: 50,
    title: '영어 이름 도입 투표',
    description:
      '"Kevin, 잠깐 봐요" — 글로벌 감성을 위해 영어 이름 도입 제안이 올라왔다. 어색하지만 설레기도 하다.',
    choices: [
      {
        label: '도입 (글로벌 감성)',
        // 모두 사기 오름 but reputation 소폭 손해 (어색한 회의)
        summary: '모두 사기 +5 (글로벌 기분) / reputation −3 (어색한 초기 혼란)',
        apply: (s) =>
          applyToAll(
            { ...s, reputation: clamp(s.reputation - 3, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + jit(5), 0, 100) }),
          ),
      },
      {
        label: '거절 (한국 이름 그대로)',
        // 모두 사기 소폭 손해 (글로벌 기회 포기 느낌)
        summary: '모두 사기 −2 (글로벌 기회 포기 느낌)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
          })),
      },
    ],
  },
  {
    id: 'friday-half-day',
    minProductCount: 10,
    title: '금요일 반차제 도입 제안',
    description:
      '"금요일 오후는 자기계발 시간으로!" 워라밸 문화 도입 제안이 왔다. 골드가 들지만 팀원들 눈빛이 달라졌다.',
    choices: [
      {
        label: '도입 (-50g)',
        // 비용 손해 but 모두 사기 크게 오름
        summary: '−50g / 모두 사기 +15 (워라밸의 꿈)',
        apply: (s) => {
          if (s.gold < 50) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 50, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + jit(15), 0, 100) }),
          );
        },
      },
      {
        label: '거절 (데드라인이 더 중요)',
        // PM 사기 오름 but 모두 사기 크게 손해
        summary: 'PM 사기 +5 (책임감) / 모두 사기 −10 (실망)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(5), 0, 100),
          }));
          return applyToAll(next, (e) =>
            e.job !== 'planner' ? { ...e, morale: clamp(e.morale - jit(10), 0, 100) } : e,
          );
        },
      },
    ],
  },
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

  // ────────── A 신규 후반 ──────────
  {
    id: 'crisis-pr-instagram',
    minProductCount: 5,
    title: '인스타에 올라온 회사 욕설',
    description:
      '익명 인스타 계정에 "oo회사 다니면 이렇게 됩니다"는 폭로 게시물이 올라왔다. 좋아요 3만. 사무실이 술렁인다.',
    choices: [
      {
        label: '공식 성명 발표 (+PR팀 투입)',
        summary: '−50g (긴급 PR비) / 팀 사기 −3 (소동) / 명성 보전',
        apply: (s) => ({
          ...s,
          gold: clamp(s.gold - jit(50), 0, MAX),
          employees: s.employees.map((e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) })),
        }),
      },
      {
        label: '무대응 (묻힐 때까지)',
        summary: '모두 사기 −6 (불안) / BugDebt +3 (집중력 저하)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(6), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(3), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'k-twitter-x-rumor',
    minProductCount: 8,
    minReputation: 50,
    title: 'X(트위터)에 퍼진 루머',
    description:
      '"oo 곧 인수된다" 트윗이 RT 5천을 넘겼다. 사실 무근이지만 직원들 메신저가 폭발했다.',
    choices: [
      {
        label: '대표가 직접 X 라이브',
        summary: 'PM 체력 −10 / 모두 사기 +8 (소문 진화) / +20g (화제성)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({ ...e, stamina: clamp(e.stamina - jit(10), 0, 100) }));
          return { ...applyToAll(next, (e) => ({ ...e, morale: clamp(e.morale + jit(8), 0, 100) })), gold: clamp(next.gold + jit(20), 0, MAX) };
        },
      },
      {
        label: '침묵 유지',
        summary: '모두 사기 −5 (찝찝함) / Progress −3%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress - jit(3), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'open-banking',
    minProductCount: 10,
    title: '오픈뱅킹 API 연동 제안',
    description:
      '금융 파트너사가 오픈뱅킹 API 연동을 제안해왔다. 구현 공수는 크지만 잠재 매출이 달콤하다.',
    choices: [
      {
        label: '지금 당장 (스프린트 투입)',
        summary: 'BugDebt +8 (급하게 붙이면) / +80g (계약금)',
        apply: (s) => ({
          ...s,
          gold: clamp(s.gold + jit(80), 0, MAX),
          project: { ...s.project, bugDebt: clamp(s.project.bugDebt + jit(8), 0, 100) },
        }),
      },
      {
        label: '다음 분기로 미룸',
        summary: '모두 사기 +3 (여유) / Progress +2%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(3), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(2), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'dev-internal-blog',
    minProductCount: 6,
    title: '개발 블로그 운영 제안',
    description:
      '개발자 중 한 명이 "기술 블로그 열면 채용 브랜딩에 좋아요"라고 했다. 운영 공수 vs 브랜드 가치.',
    choices: [
      {
        label: '공식 블로그 개설 (개발자 주도)',
        summary: '개발자 체력 −10 / +40g (브랜딩 효과) / 사기 +5',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({ ...e, stamina: clamp(e.stamina - jit(10), 0, 100) }));
          return { ...applyToAll(next, (e) => ({ ...e, morale: clamp(e.morale + jit(5), 0, 100) })), gold: clamp(next.gold + jit(40), 0, MAX) };
        },
      },
      {
        label: '개인 블로그로 (회사 지원 없음)',
        summary: '개발자 사기 −3 (아쉬움) / BugDebt −2 (여유 시간 활용)',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(2), 0, 100) } };
        },
      },
    ],
  },

  // ────────── B 신규 후반 ──────────
  {
    id: 'ai-debate-summit',
    minProductCount: 10,
    minReputation: 60,
    title: 'AI 윤리 토론 참가 제안',
    description:
      '업계 AI 윤리 써밋에서 발표 요청이 왔다. 좋은 이미지이지만 스프린트 일정이 빠듯하다.',
    choices: [
      {
        label: '발표 수락 (PM 파견)',
        summary: 'PM 체력 −15 / +60g (네트워킹) / 모두 사기 +5',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({ ...e, stamina: clamp(e.stamina - jit(15), 0, 100) }));
          return { ...applyToAll(next, (e) => ({ ...e, morale: clamp(e.morale + jit(5), 0, 100) })), gold: clamp(next.gold + jit(60), 0, MAX) };
        },
      },
      {
        label: '서면 의견서만 제출',
        summary: '모두 체력 +2 (여유) / Progress +3%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, stamina: clamp(e.stamina + jit(2), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(3), 0, 100) } };
        },
      },
    ],
  },

  // ────────── C 신규 후반 ──────────
  {
    id: 'bug-bounty',
    minProductCount: 8,
    title: '버그 바운티 프로그램 제안',
    description:
      '외부 보안 연구자가 심각한 취약점을 제보하며 버그 바운티를 요청해왔다. 지금 없으면 만들어야 한다.',
    choices: [
      {
        label: '바운티 지급 후 공식 프로그램 운영',
        summary: '−80g (현재 취약점 보상) / BugDebt −8 (즉시 수정)',
        apply: (s) => ({
          ...s,
          gold: clamp(s.gold - jit(80), 0, MAX),
          project: { ...s.project, bugDebt: clamp(s.project.bugDebt - jit(8), 0, 100) },
        }),
      },
      {
        label: '내부 패치만 (바운티 거절)',
        summary: 'BugDebt −4 / 모두 사기 −3 (불편한 결정)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(4), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'compliance-audit-eu',
    minProductCount: 12,
    minReputation: 80,
    title: 'EU 규정 준수 감사',
    description:
      'EU GDPR 준수 여부 감사 통보가 왔다. 준비가 안 되어 있다면 과징금이 나올 수 있다.',
    choices: [
      {
        label: '법무팀 긴급 투입',
        summary: '−100g (컨설팅 비용) / BugDebt −5 (코드 정리) / 모두 체력 −5',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, stamina: clamp(e.stamina - jit(5), 0, 100) }));
          return { ...next, gold: clamp(next.gold - jit(100), 0, MAX), project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(5), 0, 100) } };
        },
      },
      {
        label: '기존 문서로 대응',
        summary: 'PM 체력 −20 (서류 작업) / +30g (과징금 회피 인센티브)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({ ...e, stamina: clamp(e.stamina - jit(20), 0, 100) }));
          return { ...next, gold: clamp(next.gold + jit(30), 0, MAX) };
        },
      },
    ],
  },
  {
    id: 'dev-conf-keynote',
    minProductCount: 15,
    minReputation: 100,
    title: '개발자 컨퍼런스 키노트 제안',
    description:
      '국내 최대 개발자 행사 키노트 발표 제안이 왔다. 회사 기술 스택과 문화를 공개할 기회다.',
    choices: [
      {
        label: '수락 (개발자 대표 파견)',
        summary: '개발자 체력 −15 / 모두 사기 +10 (자부심) / +80g (홍보 효과)',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({ ...e, stamina: clamp(e.stamina - jit(15), 0, 100) }));
          return { ...applyToAll(next, (e) => ({ ...e, morale: clamp(e.morale + jit(10), 0, 100) })), gold: clamp(next.gold + jit(80), 0, MAX) };
        },
      },
      {
        label: '거절 (바쁘다)',
        summary: '모두 사기 −2 (아쉬움) / Progress +4% (집중)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(2), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(4), 0, 100) } };
        },
      },
    ],
  },

  // ────────── D 신규 후반 ──────────
  {
    id: 'q4-bonus-cut',
    minProductCount: 6,
    title: '연말 보너스 삭감 통보',
    description:
      '"올해 실적이 아쉬워 연말 보너스를 축소합니다." CFO 이메일 한 줄이 사무실을 얼어붙혔다.',
    choices: [
      {
        label: '팀장이 위에 강하게 항의',
        summary: 'PM 사기 −10 (소모) / 팀원 사기 +5 (PM이 싸워줌)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({ ...e, morale: clamp(e.morale - jit(10), 0, 100) }));
          return { ...next, employees: next.employees.map((e) => e.job !== 'planner' ? { ...e, morale: clamp(e.morale + jit(5), 0, 100) } : e) };
        },
      },
      {
        label: '조용히 수용 (현실이다)',
        summary: '모두 사기 −8 (낙심) / BugDebt +4 (의욕 저하)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(8), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(4), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'parental-leave-policy',
    minProductCount: 8,
    title: '육아휴직 확대 정책 도입',
    description:
      'HR이 육아휴직을 최대 2년으로 확대하는 안을 들고 왔다. 좋은 문화지만 단기 인력 공백이 생긴다.',
    choices: [
      {
        label: '전격 도입 공표',
        summary: '모두 사기 +8 (문화 자부심) / Progress −5% (일부 인력 공백)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(8), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress - jit(5), 0, 100) } };
        },
      },
      {
        label: '단계적 검토 (내년부터)',
        summary: '모두 사기 −2 (실망) / BugDebt −2 (안정적 스프린트)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(2), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(2), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'unionization-talk',
    minProductCount: 10,
    title: '노조 결성 논의',
    description:
      '직원 일부가 조합 결성을 논의 중이라는 소문이 돌고 있다. 경영진은 긴장하고 있다.',
    choices: [
      {
        label: '열린 대화 채널 제공',
        summary: '모두 사기 +6 (신뢰) / +30g (갈등 예방)',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(6), 0, 100) })),
          gold: clamp(s.gold + jit(30), 0, MAX),
        }),
      },
      {
        label: '모른 척 (알아서 꺼지겠지)',
        summary: '모두 사기 −5 / BugDebt +4 (긴장감)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(4), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'industry-poach-attempt',
    minProductCount: 12,
    minReputation: 90,
    title: '대기업 인재 스카웃 시도',
    description:
      '경쟁사 대기업이 우리 핵심 시니어 개발자에게 연봉 2배를 제시했다는 얘기가 들어왔다.',
    choices: [
      {
        label: '리텐션 패키지 제공 (-200g)',
        summary: '−200g / 해당 개발자 사기 +20 / 모두 사기 +5',
        apply: (s) => {
          if (s.gold < 200) return s;
          return {
            ...applyToAll({ ...s, gold: clamp(s.gold - 200, 0, MAX) }, (e) =>
              e.job === 'programmer' ? { ...e, morale: clamp(e.morale + jit(20), 0, 100) } : { ...e, morale: clamp(e.morale + jit(5), 0, 100) },
            ),
          };
        },
      },
      {
        label: '개인 결정에 맡긴다',
        summary: '개발자 사기 −15 (배신감?) / BugDebt +6',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({ ...e, morale: clamp(e.morale - jit(15), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(6), 0, 100) } };
        },
      },
    ],
  },

  // ────────── E 신규 후반 ──────────
  {
    id: 'work-from-anywhere',
    minProductCount: 10,
    title: '원격 근무 어디서나 정책 도입',
    description:
      '"제주, 강원, 심지어 발리에서도 일할 수 있게 해달라"는 요청이 설문에 65%로 올라왔다.',
    choices: [
      {
        label: '워크프롬애니웨어 공식 허용',
        summary: '모두 사기 +10 / BugDebt +4 (협업 지연) / 개발자 사기 +8',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(10), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(4), 0, 100) } };
        },
      },
      {
        label: '국내 한정 유지',
        summary: '모두 사기 −3 (기대 못 맞춤) / Progress +2%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(2), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'side-project-policy',
    minProductCount: 8,
    title: '사이드 프로젝트 허용 정책',
    description:
      '"개인 프로젝트를 업무 시간 20%에서 해도 됩니까?" 구글 20% 룰 논쟁이 다시 터졌다.',
    choices: [
      {
        label: '20% 타임 공식 인정',
        summary: '모두 사기 +7 / Progress −5% (집중 분산)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(7), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress - jit(5), 0, 100) } };
        },
      },
      {
        label: '업무 시간은 업무만',
        summary: '모두 사기 −4 / BugDebt −3 (집중)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(4), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(3), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'company-retreat-jeju',
    minProductCount: 7,
    title: '제주 워크숍 개최',
    description:
      '분기 목표 달성 기념 제주 워크숍 안건이 올라왔다. 비용은 크지만 팀 결속력 회복에 효과적이다.',
    choices: [
      {
        label: '다 같이 제주 가자 (-120g)',
        summary: '−120g / 모두 사기 +15, 체력 +10 (재충전)',
        apply: (s) => {
          if (s.gold < 120) return s;
          return applyToAll({ ...s, gold: clamp(s.gold - 120, 0, MAX) }, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(15), 0, 100),
            stamina: clamp(e.stamina + jit(10), 0, 100),
          }));
        },
      },
      {
        label: '온라인 화상 회식으로 대체',
        summary: '−20g (배달 쿠폰) / 모두 사기 +4',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(4), 0, 100) })),
          gold: clamp(s.gold - jit(20), 0, MAX),
        }),
      },
    ],
  },

  // ────────── F 신규 후반 ──────────
  {
    id: 'series-c-failed',
    minProductCount: 10,
    minReputation: 60,
    title: '시리즈 C 투자 협상 결렬',
    description:
      '"valuation 협의 불발"이라는 메시지와 함께 VC가 텀시트를 거둬들였다. 런웨이 압박이 실감된다.',
    choices: [
      {
        label: '브릿지 파이낸싱 추진',
        summary: '모두 사기 −5 (불안) / BugDebt +3 (긴급 출시 압박)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(3), 0, 100) } };
        },
      },
      {
        label: '자력갱생 (비용 절감 모드)',
        summary: '모두 체력 −5 (긴축) / BugDebt −3 (불필요한 피처 제거)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, stamina: clamp(e.stamina - jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(3), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'patent-troll',
    minProductCount: 12,
    minReputation: 80,
    title: '특허 괴물 침략',
    description:
      '"귀사의 제품이 우리 특허를 침해합니다." 내용증명이 도착했다. 실체 없는 특허 회사다.',
    choices: [
      {
        label: '법무법인에 의뢰 (맞소)',
        summary: '−150g (법무비) / 모두 사기 −3 (스트레스) / BugDebt −2 (코드 리뷰 기회)',
        apply: (s) => {
          const next = applyToAll({ ...s, gold: clamp(s.gold - jit(150), 0, MAX) }, (e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(2), 0, 100) } };
        },
      },
      {
        label: '합의금 지불 (조용히 해결)',
        summary: '−80g / 모두 사기 −6 (굴복감)',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(6), 0, 100) })),
          gold: clamp(s.gold - jit(80), 0, MAX),
        }),
      },
    ],
  },
  {
    id: 'github-star-50k',
    minProductCount: 8,
    minReputation: 70,
    title: 'GitHub 스타 5만 돌파',
    description:
      '오픈소스 연동 라이브러리가 GitHub 스타 5만을 넘었다. 해외 개발자들의 PR과 이슈가 쏟아진다.',
    choices: [
      {
        label: '컨트리뷰터 웰컴 이벤트 개최',
        summary: '−30g / 모두 사기 +12 (자부심) / +60g (후원 및 스폰십)',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(12), 0, 100) })),
          gold: clamp(s.gold - 30 + jit(60), 0, MAX),
        }),
      },
      {
        label: '조용히 유지 (관리 부담 최소화)',
        summary: '모두 사기 +5 / Progress +3%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(3), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'foreign-vc-visit',
    minProductCount: 10,
    minReputation: 100,
    title: '해외 VC 방문 실사',
    description:
      '실리콘밸리 VC가 실사 방문을 예고했다. 사무실 청소부터 데모 준비까지 주말이 없다.',
    choices: [
      {
        label: '완벽 준비 (전력 투구)',
        summary: '모두 체력 −15 / +200g (투자 의향서) / 모두 사기 +5',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, stamina: clamp(e.stamina - jit(15), 0, 100), morale: clamp(e.morale + jit(5), 0, 100) }));
          return { ...next, gold: clamp(next.gold + jit(200), 0, MAX) };
        },
      },
      {
        label: '있는 그대로 보여주기',
        summary: '모두 사기 +8 (진정성) / +50g',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(8), 0, 100) })),
          gold: clamp(s.gold + jit(50), 0, MAX),
        }),
      },
    ],
  },
  {
    id: 'antitrust-investigation',
    minProductCount: 20,
    minReputation: 150,
    title: '공정거래위원회 조사',
    description:
      '"귀사의 시장 지배적 지위 남용 혐의로 조사를 개시합니다." 당신의 회사가 커졌다는 뜻이기도 하다.',
    choices: [
      {
        label: '전면 협조 (법무팀 풀가동)',
        summary: '−200g / 모두 사기 −5 / BugDebt −4 (코드 감사 기회)',
        apply: (s) => {
          const next = applyToAll({ ...s, gold: clamp(s.gold - jit(200), 0, MAX) }, (e) => ({ ...e, morale: clamp(e.morale - jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(4), 0, 100) } };
        },
      },
      {
        label: '최소 대응 (진술만)',
        summary: '모두 사기 −8 (불안) / BugDebt +5',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(8), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(5), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'ipo-roadshow',
    minProductCount: 18,
    minReputation: 200,
    title: 'IPO 로드쇼 준비',
    description:
      'IB 팀이 기관투자자 대상 로드쇼 일정을 잡았다. 창업 이후 최대 이벤트가 코앞이다.',
    choices: [
      {
        label: 'CEO + CFO 풀타임 투입',
        summary: 'PM 체력 −20 / +300g (사전 청약 프리미엄) / 모두 사기 +10',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({ ...e, stamina: clamp(e.stamina - jit(20), 0, 100) }));
          return { ...applyToAll(next, (e) => ({ ...e, morale: clamp(e.morale + jit(10), 0, 100) })), gold: clamp(next.gold + jit(300), 0, MAX) };
        },
      },
      {
        label: '분산 대응 (부서별 담당)',
        summary: '모두 체력 −8 / +120g / Progress −4%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, stamina: clamp(e.stamina - jit(8), 0, 100) }));
          return { ...next, gold: clamp(next.gold + jit(120), 0, MAX), project: { ...next.project, progress: clamp(next.project.progress - jit(4), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'sxsw-keynote',
    minProductCount: 15,
    minReputation: 120,
    title: 'SXSW 키노트 초청',
    description:
      '오스틴 SXSW에서 키노트 발표 초청장이 왔다. 글로벌 무대에 이름을 알릴 찬스.',
    choices: [
      {
        label: '대표 직접 참가 (해외 출장)',
        summary: '−100g (출장비) / 모두 사기 +12 / +150g (파트너십)',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(12), 0, 100) })),
          gold: clamp(s.gold - 100 + jit(150), 0, MAX),
        }),
      },
      {
        label: '영상 메시지 대체 (비용 절감)',
        summary: '모두 사기 +4 / Progress +2%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(4), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(2), 0, 100) } };
        },
      },
    ],
  },

  // ────────── G 신규 후반 ──────────
  {
    id: 'tech-magazine-cover',
    minProductCount: 12,
    minReputation: 100,
    title: '테크 매거진 표지 모델',
    description:
      '"이달의 혁신 기업"으로 선정돼 국내 테크 매거진 표지에 팀 단체 사진을 요청받았다.',
    choices: [
      {
        label: '촬영 수락 (반차 소진)',
        summary: '모두 체력 −5 / 모두 사기 +12 (자부심) / +50g',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(12), 0, 100), stamina: clamp(e.stamina - jit(5), 0, 100) })),
          gold: clamp(s.gold + jit(50), 0, MAX),
        }),
      },
      {
        label: '대표만 촬영',
        summary: '모두 사기 −2 (소외감) / BugDebt −2',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(2), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(2), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'design-award',
    minProductCount: 8,
    minReputation: 60,
    title: '디자인 어워드 수상',
    description:
      '국내 앱 디자인 어워드 수상 소식이 전해졌다. 디자이너가 환호성을 질렀다.',
    choices: [
      {
        label: '수상 기념 팀 디너 (-50g)',
        summary: '−50g / 디자이너 사기 +15 / 모두 사기 +8',
        apply: (s) => ({
          ...applyToAll({ ...s, gold: clamp(s.gold - 50, 0, MAX) }, (e) =>
            e.job === 'designer' ? { ...e, morale: clamp(e.morale + jit(15), 0, 100) } : { ...e, morale: clamp(e.morale + jit(8), 0, 100) },
          ),
        }),
      },
      {
        label: '슬랙 공지로 마무리',
        summary: '디자이너 사기 +8 / 모두 사기 +3',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + (e.job === 'designer' ? jit(8) : jit(3)), 0, 100),
          })),
      },
    ],
  },

  // ────────── H 신규 후반 ──────────
  {
    id: 'github-octocat-pin',
    minProductCount: 5,
    title: 'GitHub Octocat 선물 도착',
    description:
      'GitHub 파트너십 기념으로 옥토캣 굿즈 박스가 회사에 배달됐다. 누가 가져갈지 정해야 한다.',
    choices: [
      {
        label: '추첨으로 공정하게',
        summary: '모두 사기 +4 (공정한 과정) / BugDebt −1',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(4), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(1), 0, 100) } };
        },
      },
      {
        label: '커밋 가장 많은 개발자에게',
        summary: '개발자 사기 +10 / 다른 직군 사기 −2',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + (e.job === 'programmer' ? jit(10) : -jit(2)), 0, 100),
          })),
      },
    ],
  },
  {
    id: 'former-employee-startup',
    minProductCount: 8,
    title: '퇴사자의 경쟁 스타트업 창업',
    description:
      '6개월 전 퇴사한 팀원이 비슷한 서비스로 창업해 시드 투자를 받았다는 뉴스가 올라왔다.',
    choices: [
      {
        label: '무시하고 우리 길을 간다',
        summary: '모두 사기 +3 (집중) / Progress +2%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(3), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(2), 0, 100) } };
        },
      },
      {
        label: '법무 검토 (비밀유지 계약 위반 여부)',
        summary: '−40g (법무 검토비) / 모두 사기 −4 (불쾌한 기억)',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(4), 0, 100) })),
          gold: clamp(s.gold - jit(40), 0, MAX),
        }),
      },
    ],
  },

  // ────────── I 신규 후반 ──────────
  {
    id: 'crashed-ec2',
    minProductCount: 5,
    title: 'EC2 인스턴스 전체 다운',
    description:
      '새벽 2시, 프로덕션 EC2 인스턴스가 전부 내려갔다. 슬랙에 불이 났다. 누가 살려낼 수 있나.',
    choices: [
      {
        label: '밤새 복구 (개발자 전원 콜)',
        summary: '개발자 체력 −20 (밤샘) / BugDebt −10 (근본 원인 제거) / −30g',
        apply: (s) => {
          const next = applyToJob({ ...s, gold: clamp(s.gold - jit(30), 0, MAX) }, 'programmer', (e) => ({ ...e, stamina: clamp(e.stamina - jit(20), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(10), 0, 100) } };
        },
      },
      {
        label: '롤백 후 내일 분석',
        summary: 'BugDebt +6 (임시방편) / 개발자 체력 −5 / Progress −4%',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({ ...e, stamina: clamp(e.stamina - jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(6), 0, 100), progress: clamp(next.project.progress - jit(4), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'database-corruption',
    minProductCount: 8,
    title: 'DB 데이터 손상 발생',
    description:
      '운영 DB 일부 테이블 데이터가 손상됐다. 백업은… 3일 전 것이 마지막이다.',
    choices: [
      {
        label: '3일치 손실 감수 후 복구',
        summary: 'BugDebt +8 (긴급 패치) / Progress −8% / 모두 사기 −8',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(8), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(8), 0, 100), progress: clamp(next.project.progress - jit(8), 0, 100) } };
        },
      },
      {
        label: '데이터 복구 전문업체 의뢰 (-200g)',
        summary: '−200g / BugDebt −5 / 모두 사기 −4',
        apply: (s) => {
          if (s.gold < 200) return s;
          const next = applyToAll({ ...s, gold: clamp(s.gold - 200, 0, MAX) }, (e) => ({ ...e, morale: clamp(e.morale - jit(4), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(5), 0, 100) } };
        },
      },
    ],
  },

  // ────────── K 신규 후반 ──────────
  {
    id: 'mentor-monday',
    minProductCount: 6,
    title: '멘토 먼데이 프로그램',
    description:
      '매주 월요일 시니어가 주니어를 1:1 멘토링하는 사내 프로그램 제안이 올라왔다.',
    choices: [
      {
        label: '공식 운영 (시니어 주도)',
        summary: '시니어 체력 −8 / 주니어 사기 +10 / BugDebt −2',
        apply: (s) => {
          const next = applyToAll(s, (e) =>
            e.rank === 'senior' || e.rank === 'lead'
              ? { ...e, stamina: clamp(e.stamina - jit(8), 0, 100) }
              : { ...e, morale: clamp(e.morale + jit(10), 0, 100) },
          );
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(2), 0, 100) } };
        },
      },
      {
        label: '자율 신청으로만',
        summary: '모두 사기 +3 (자율성) / Progress +1%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(3), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(1), 0, 100) } };
        },
      },
    ],
  },
  {
    id: 'pet-policy-vote',
    minProductCount: 5,
    title: '반려동물 출근 허용 투표',
    description:
      '"반려견·반려묘 출근 가능하게 해달라"는 요청이 사내 익명 게시판에 올라와 투표가 시작됐다. 찬반이 팽팽하다.',
    choices: [
      {
        label: '허용 (규칙 만들고)',
        summary: '모두 사기 +6 / BugDebt +2 (분위기 산만)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(6), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(2), 0, 100) } };
        },
      },
      {
        label: '불허 (알러지 배려)',
        summary: '모두 사기 −2 (아쉬움) / Progress +1%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(2), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(1), 0, 100) } };
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
