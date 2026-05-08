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

export interface EventChoice {
  readonly label: string;
  readonly summary: string;
  readonly apply: (state: GameState) => GameState;
}

export interface GameEvent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly choices: ReadonlyArray<EventChoice>;
  readonly canTrigger?: (state: GameState) => boolean;
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
        summary: 'PM 체력 −15',
        apply: (s) =>
          applyToJob(s, 'planner', (e) => ({ ...e, stamina: clamp(e.stamina - 15, 0, 100) })),
      },
      {
        label: '월요일에 답합니다',
        summary: '모두 사기 −3 (단톡 압박 잔영)',
        apply: (s) =>
          applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 3, 0, 100) })),
      },
    ],
  },
  {
    id: 'short-meeting-trap',
    title: '"잠깐 시간 되세요?"',
    description: '한 명이 30분만 보겠다고 한 회의가 1시간 50분째 진행 중이다.',
    choices: [
      {
        label: '끝까지 듣는다',
        summary: '모두 체력 −5',
        apply: (s) => applyToAll(s, (e) => ({ ...e, stamina: clamp(e.stamina - 5, 0, 100) })),
      },
      {
        label: '"화장실 좀…"하고 빠진다',
        summary: 'PM 사기 −5 (대신 들어준 사람의 원망)',
        apply: (s) =>
          applyToJob(s, 'planner', (e) => ({ ...e, morale: clamp(e.morale - 5, 0, 100) })),
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
        summary: 'Progress −5%, BugDebt +6, PM 사기 −3',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              progress: clamp(s.project.progress - 5, 0, 100),
              bugDebt: clamp(s.project.bugDebt + 6, 0, 100),
            },
          };
          return applyToJob(next, 'planner', (e) => ({ ...e, morale: clamp(e.morale - 3, 0, 100) }));
        },
      },
      {
        label: '다음 버전으로',
        summary: '변화 없음 (BD가 임원 단톡에 한 번 띄울 것)',
        apply: (s) => s,
      },
    ],
  },
  {
    id: 'okr-quarter',
    title: '분기 OKR 작성',
    description:
      'KR 적기 시즌. 모두 노트북 앞에 앉아 "분기 후 회고에서 잘 보일 KR"을 짜고 있다.',
    choices: [
      {
        label: '진지하게 작성',
        summary: 'PM 체력 −15, 다음 분기 평가 +(은연중)',
        apply: (s) =>
          applyToJob(s, 'planner', (e) => ({ ...e, stamina: clamp(e.stamina - 15, 0, 100) })),
      },
      {
        label: '지난 분기 KR 복붙',
        summary: '모두 사기 −2 (또 그렇게)',
        apply: (s) => applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 2, 0, 100) })),
      },
    ],
  },
  {
    id: 'exec-pt-deck',
    title: '임원 PT 자료 요청',
    description: '다음 주 보고용 슬라이드 자료를 만들어 달라는 요청. 100장 정도면 좋겠다고 한다.',
    choices: [
      {
        label: '전 팀이 자료 작업',
        summary: '모두 1주 체력 −10',
        apply: (s) =>
          applyToAll(s, (e) => ({ ...e, stamina: clamp(e.stamina - 10, 0, 100) })),
      },
      {
        label: 'PM 혼자 야간 작업',
        summary: 'PM 체력 −25, 사기 −5',
        apply: (s) =>
          applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - 25, 0, 100),
            morale: clamp(e.morale - 5, 0, 100),
          })),
      },
    ],
  },

  // ────────── C. 개발·기술 ──────────
  {
    id: 'k-agile-adoption',
    title: '에자일 도입 워크샵',
    description:
      '외부 코치를 초청해 에자일 도입 워크샵 진행. 데일리 스탠드업, 회고 다 도입하기로 했다. 한 달 뒤를 기대해 보자.',
    choices: [
      {
        label: '제대로 도입',
        summary: '−50g, 1주, 다음 분기 효율 +5% (개발 직원 skill +0.05)',
        apply: (s) => {
          if (s.gold < 50) return s;
          const next = { ...s, gold: clamp(s.gold - 50, 0, MAX) };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            skill: clamp(e.skill + 0.05, 0, 2),
          }));
        },
      },
      {
        label: '스탠드업만 도입 (그러다 곧 폐기)',
        summary: '모두 사기 −3 (또 형식만)',
        apply: (s) =>
          applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 3, 0, 100) })),
      },
    ],
  },
  {
    id: 'k-devops-transition',
    title: 'DevOps 전환 선언',
    description:
      '"앞으로 운영도 개발자가 같이 가져가는 걸로." 인프라 채용은 다음 분기로 미뤘다고 한다.',
    choices: [
      {
        label: '수용',
        summary: '개발자 매주 체력 −5 (지속), BugDebt 누적 −3',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - 3, 0, 100) },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina - 8, 0, 100),
            morale: clamp(e.morale - 3, 0, 100),
          }));
        },
      },
      {
        label: '인프라 채용 강력 요구',
        summary: 'PM 사기 +3 / 다음 협상으로',
        apply: (s) =>
          applyToJob(s, 'planner', (e) => ({ ...e, morale: clamp(e.morale + 3, 0, 100) })),
      },
    ],
  },
  {
    id: 'ai-coding-tool',
    title: 'AI 코딩 도구 도입 회의',
    description:
      'Copilot·Cursor 류 도입 검토. 한쪽은 "이미 안 쓰면 손해", 다른 쪽은 "코드 유출은요?". 결정 시간이 왔다.',
    canTrigger: (s) => s.productIndex >= 1,
    choices: [
      {
        label: '도입 (-30g)',
        summary: '개발자 효율 +5% / 보수파 직원 사기 −5',
        apply: (s) => {
          if (s.gold < 30) return s;
          const next = { ...s, gold: clamp(s.gold - 30, 0, MAX) };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            skill: clamp(e.skill + 0.04, 0, 2),
          }));
        },
      },
      {
        label: '보안 검토 후 결정 (= 보류)',
        summary: '모두 사기 ±0 (의견 갈림으로 끝)',
        apply: (s) => s,
      },
    ],
  },
  {
    id: 'legacy-found',
    title: '레거시 코드 발견',
    description:
      '예전 어느 분이 짠 코드. 주석에 "TODO: 정리 필요"가 박혀 있고, 그게 본인이라는 사실이 git blame에서 드러났다.',
    canTrigger: (s) => s.productIndex >= 1,
    choices: [
      {
        label: '리팩터링 진행',
        summary: 'Progress −3%, BugDebt −15',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            progress: clamp(s.project.progress - 3, 0, 100),
            bugDebt: clamp(s.project.bugDebt - 15, 0, 100),
          },
        }),
      },
      {
        label: '주석 한 줄 더 (// 다음에)',
        summary: 'BugDebt +3',
        apply: (s) => ({
          ...s,
          project: { ...s.project, bugDebt: clamp(s.project.bugDebt + 3, 0, 100) },
        }),
      },
    ],
  },
  {
    id: 'stability-quarter',
    title: '"이번 분기는 안정화" 선언',
    description: '임원이 분기 시작에 안정화 선언을 했다. 매번 그랬듯, 이번에도 그럴 것이다.',
    choices: [
      {
        label: '실제로 안정화',
        summary: '1주 +, BugDebt −10',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            weeksElapsed: s.project.weeksElapsed + 1,
            bugDebt: clamp(s.project.bugDebt - 10, 0, 100),
          },
        }),
      },
      {
        label: '말만 안정화',
        summary: '모두 사기 −2 (또…)',
        apply: (s) => applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 2, 0, 100) })),
      },
    ],
  },

  // ────────── D. 조직·HR ──────────
  {
    id: 'reorg-quarterly',
    title: '분기 조직 개편 통보',
    description:
      '"이번 분기부터 조직이 다음과 같이 재편됩니다." 보고 라인 일부 변경, 팀명 변경. 실체는 같은 사람들.',
    canTrigger: (s) => s.productIndex >= 1,
    choices: [
      {
        label: '따른다',
        summary: '모두 사기 −5 (1주 적응)',
        apply: (s) =>
          applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 5, 0, 100) })),
      },
      {
        label: 'PM이 대신 항의',
        summary: 'PM 사기 −10, 결과 동일',
        apply: (s) =>
          applyToJob(s, 'planner', (e) => ({ ...e, morale: clamp(e.morale - 10, 0, 100) })),
      },
    ],
  },
  {
    id: 'flat-org-rename',
    title: '"전 직급 ㅇㅇ님 통일"',
    description:
      '오늘부터 호칭을 모두 통일한다고 한다. 결정은 그대로 위에서 내려오겠지만 형식은 더 수평적이다.',
    canTrigger: (s) => s.productIndex >= 1,
    choices: [
      {
        label: '바로 적응',
        summary: '모두 사기 +1 (잠깐 농담)',
        apply: (s) =>
          applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + 1, 0, 100) })),
      },
      {
        label: '그냥 박코더 박과장 둘 다 부른다',
        summary: '변화 없음',
        apply: (s) => s,
      },
    ],
  },
  {
    id: 'new-exec-onboarding',
    title: '신임 임원 합류',
    description:
      '신임 임원이 방금 합류했다. 첫 분기에 대대적인 변화를 예고하고 있다. 모든 정책이 reset 될지 모른다.',
    canTrigger: (s) => s.productIndex >= 2,
    choices: [
      {
        label: '환영 분위기 맞추기',
        summary: '모두 사기 −3, 이후 BugDebt 정책 변경 가능 (단기 −0)',
        apply: (s) =>
          applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 3, 0, 100) })),
      },
      {
        label: '조용히 본업',
        summary: '모두 사기 −5 (못 끼어든 죄책감)',
        apply: (s) =>
          applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 5, 0, 100) })),
      },
    ],
  },
  {
    id: 'exit-interview',
    title: '퇴사 면담 요청',
    description: '한 직원이 따로 1:1을 요청해 왔다. 평소 사기가 많이 떨어져 있던 사람이다.',
    canTrigger: (s) => avgMorale(s) < 40,
    choices: [
      {
        label: '카운터 오퍼 (-150g)',
        summary: '모두 사기 +15 (분위기 회복), 골드 압박',
        apply: (s) => {
          if (s.gold < 150) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 150, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + 15, 0, 100) }),
          );
        },
      },
      {
        label: '본인 결정 존중 (= 떠남)',
        summary: '가장 사기 낮은 1명 퇴사 (랜덤 직군)',
        apply: (s) => {
          if (s.employees.length <= 2) return s; // 너무 적으면 보호
          let lowestIdx = 0;
          for (let i = 1; i < s.employees.length; i++) {
            const a = s.employees[i];
            const b = s.employees[lowestIdx];
            if (a && b && a.morale < b.morale) lowestIdx = i;
          }
          return {
            ...s,
            employees: s.employees.filter((_, i) => i !== lowestIdx),
            assignment: Object.fromEntries(
              Object.entries(s.assignment).filter(
                ([, id]) => id !== s.employees[lowestIdx]?.id,
              ),
            ),
          };
        },
      },
    ],
  },
  {
    id: 'quarterly-dinner',
    title: '분기 회식',
    description: '분기 마감 기념 회식 안내가 단톡에 떴다. "강제 아닙니다" 이모지와 함께.',
    choices: [
      {
        label: '쏜다 (-50g)',
        summary: '모두 사기 +12, 다음 1주 체력 −5',
        apply: (s) => {
          if (s.gold < 50) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 50, 0, MAX) },
            (e) => ({
              ...e,
              morale: clamp(e.morale + 12, 0, 100),
              stamina: clamp(e.stamina - 5, 0, 100),
            }),
          );
        },
      },
      {
        label: '오늘은 패스',
        summary: '모두 사기 −2',
        apply: (s) =>
          applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 2, 0, 100) })),
      },
    ],
  },

  // ────────── E. 출시·운영 ──────────
  {
    id: 'launch-day-traffic',
    title: '런칭 직후 트래픽 폭주',
    description:
      '출시 직후 그래프가 가파르게 솟고 있다. 한쪽은 "축하"라고 하고 다른 쪽은 "이거 서버가 견디나?"라고 한다.',
    canTrigger: (s) => s.project.weeksElapsed >= 8,
    choices: [
      {
        label: '비상 대응',
        summary: '−40g, 개발자 체력 −10, BugDebt −5',
        apply: (s) => {
          if (s.gold < 40) return s;
          const next = {
            ...s,
            gold: clamp(s.gold - 40, 0, MAX),
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - 5, 0, 100) },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina - 10, 0, 100),
          }));
        },
      },
      {
        label: '일단 지켜본다',
        summary: 'BugDebt +8 (장애 위험 ↑)',
        apply: (s) => ({
          ...s,
          project: { ...s.project, bugDebt: clamp(s.project.bugDebt + 8, 0, 100) },
        }),
      },
    ],
  },
  {
    id: 'cs-flood',
    title: 'CS 폭주',
    description: '커뮤니티 게시판에 사용자 문의가 쏟아지고 있다. 백오피스가 미흡해 응답이 늦다.',
    canTrigger: (s) => s.project.bugDebt > 50,
    choices: [
      {
        label: '내부 대응',
        summary: '모두 1주 체력 −8, BugDebt −5',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - 5, 0, 100) },
          };
          return applyToAll(next, (e) => ({ ...e, stamina: clamp(e.stamina - 8, 0, 100) }));
        },
      },
      {
        label: '외주 응대 (-40g)',
        summary: 'BugDebt 변화 없음, 사용자 후기 ↓ (Appeal −3)',
        apply: (s) => ({
          ...s,
          gold: clamp(s.gold - 40, 0, MAX),
          project: { ...s.project, appeal: clamp(s.project.appeal - 3, 0, 100) },
        }),
      },
    ],
  },

  // ────────── F. 외부·산업 ──────────
  {
    id: 'series-funding',
    title: '시리즈 펀딩 라운드',
    description:
      'VC 미팅이 들어왔다. 가치 평가는 좋게 나왔지만, 받으면 다음 분기 KPI 압박이 강해진다.',
    canTrigger: (s) => s.productIndex >= 2,
    choices: [
      {
        label: '투자 유치 (+200g)',
        summary: '골드 +200 / 모두 사기 −3 (KPI 압박)',
        apply: (s) =>
          applyToAll(
            { ...s, gold: clamp(s.gold + 200, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale - 3, 0, 100) }),
          ),
      },
      {
        label: '자체 자금으로 (보수)',
        summary: '변화 없음',
        apply: (s) => s,
      },
    ],
  },
  {
    id: 'trend-shift',
    title: '시장 트렌드 변화',
    description:
      '한 분기 사이 업계 분위기가 또 바뀌었다. AI 봄이라느니, 에이전트가 답이라느니. 우리 프로젝트는 어디에 있나.',
    canTrigger: (s) => s.productIndex >= 1,
    choices: [
      {
        label: '본업 집중',
        summary: 'Progress +3%',
        apply: (s) => ({
          ...s,
          project: { ...s.project, progress: clamp(s.project.progress + 3, 0, 100) },
        }),
      },
      {
        label: '트렌드 살짝 반영',
        summary: 'Appeal +5 (해당 시), BugDebt +5',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            appeal: s.project.appealEnabled
              ? clamp(s.project.appeal + 5, 0, 100)
              : s.project.appeal,
            bugDebt: clamp(s.project.bugDebt + 5, 0, 100),
          },
        }),
      },
    ],
  },
  {
    id: 'tech-conf-booth',
    title: '테크 컨퍼런스 부스 제안',
    description: '대형 테크 컨퍼런스에서 부스 자리 제안. 노출은 크지만 비용도 크다.',
    canTrigger: (s) => s.project.appealEnabled && s.gold >= 80,
    choices: [
      {
        label: '부스 참가 (-80g)',
        summary: 'Appeal +12',
        apply: (s) => ({
          ...s,
          gold: clamp(s.gold - 80, 0, MAX),
          project: { ...s.project, appeal: clamp(s.project.appeal + 12, 0, 100) },
        }),
      },
      {
        label: '패스',
        summary: '변화 없음',
        apply: (s) => s,
      },
    ],
  },
  {
    id: 'competitor-release',
    title: '경쟁작 출시',
    description: '비슷한 컨셉의 서비스가 막 런칭됐다. 차별화에 박차를 가할까, 신경 끄고 갈까.',
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
        summary: '모두 사기 −3',
        apply: (s) => applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 3, 0, 100) })),
      },
    ],
  },
  {
    id: 'friend-team-launch',
    title: '친구 팀 런칭',
    description: '친한 다른 팀이 오늘 출시했다. 우리도 자극을 받는다.',
    choices: [
      {
        label: '자축 회식 (-25g)',
        summary: '모두 사기 +10',
        apply: (s) => {
          if (s.gold < 25) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 25, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + 10, 0, 100) }),
          );
        },
      },
      {
        label: '신경 안 씀',
        summary: '모두 사기 −5',
        apply: (s) => applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 5, 0, 100) })),
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
    id: 'laptop-died',
    title: '랩탑 사망',
    description: '한 명의 작업 환경이 갑자기 멈췄다. 새 장비를 바로 사 줄지, 수리 대기시킬지.',
    choices: [
      {
        label: '바로 교체 (-40g)',
        summary: '아무 영향 없음',
        apply: (s) => ({ ...s, gold: clamp(s.gold - 40, 0, MAX) }),
      },
      {
        label: '수리 대기',
        summary: '무작위 한 명 사기 −5, 체력 −10',
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

  // ────────── H. 코미디·민간 신앙 ──────────
  {
    id: 'laptop-left-overnight',
    title: '노트북 두고 퇴근',
    description: '한 명이 노트북을 두고 퇴근했다. 다음날 새벽, 알 수 없는 장애가 발생했다.',
    choices: [
      {
        label: '새벽 수습 (개발자 야간 대응)',
        summary: '개발자 체력 −15, BugDebt −5',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - 5, 0, 100) },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina - 15, 0, 100),
          }));
        },
      },
      {
        label: '아침에 출근해서',
        summary: 'BugDebt +8, 모두 사기 −3',
        apply: (s) =>
          applyToAll(
            { ...s, project: { ...s.project, bugDebt: clamp(s.project.bugDebt + 8, 0, 100) } },
            (e) => ({ ...e, morale: clamp(e.morale - 3, 0, 100) }),
          ),
      },
    ],
  },
  {
    id: 'ceo-only-bug',
    title: '대표님 폰에서만 재현',
    description: '대표가 어제 미팅에서 자기 폰으로 시연했더니 버그가 났다. 회사 내에선 재현이 안 된다.',
    canTrigger: (s) => s.project.bugDebt > 50,
    choices: [
      {
        label: '대표 폰 가져와서 디버깅',
        summary: '개발자 체력 −12, BugDebt −10',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - 10, 0, 100) },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina - 12, 0, 100),
          }));
        },
      },
      {
        label: '"환경 이슈로 보입니다"',
        summary: '대표 신뢰 ↓ (모두 사기 −5)',
        apply: (s) => applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 5, 0, 100) })),
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
        summary: '모두 사기 +5',
        apply: (s) => applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + 5, 0, 100) })),
      },
    ],
  },

  // ────────── I. 사고·재해 ──────────
  {
    id: 'security-incident',
    title: '보안 사고 발생',
    description: '운영 로그에서 비정상 접근 시그널이 발견됐다. 일단 대응 회의 소집.',
    canTrigger: (s) => s.project.bugDebt > 40,
    choices: [
      {
        label: '즉시 패치 + 외부 보안 (-80g)',
        summary: 'BugDebt −12, 모두 1주 체력 −8',
        apply: (s) => {
          if (s.gold < 80) return s;
          const next = {
            ...s,
            gold: clamp(s.gold - 80, 0, MAX),
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - 12, 0, 100) },
          };
          return applyToAll(next, (e) => ({ ...e, stamina: clamp(e.stamina - 8, 0, 100) }));
        },
      },
      {
        label: '내부 자체 패치',
        summary: 'BugDebt −5, 개발자 체력 −15, Appeal −5 (외부 의심)',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              bugDebt: clamp(s.project.bugDebt - 5, 0, 100),
              appeal: clamp(s.project.appeal - 5, 0, 100),
            },
          };
          return applyToJob(next, 'programmer', (e) => ({
            ...e,
            stamina: clamp(e.stamina - 15, 0, 100),
          }));
        },
      },
    ],
  },
  {
    id: 'prod-push-accident',
    title: '테스트 → PROD 푸시 사고',
    description: '한 명이 환경 변수를 헷갈려 테스트로 의도된 변경이 PROD에 올라갔다. QA가 비어 있을 땐 자주 나온다.',
    canTrigger: (s) => !s.assignment.qa,
    choices: [
      {
        label: '롤백 + 회고',
        summary: 'BugDebt −3, 1주 체력 −5 (모두), 사기 −3',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - 3, 0, 100) },
          };
          return applyToAll(next, (e) => ({
            ...e,
            stamina: clamp(e.stamina - 5, 0, 100),
            morale: clamp(e.morale - 3, 0, 100),
          }));
        },
      },
      {
        label: '핫픽스로 덮기',
        summary: 'BugDebt +8',
        apply: (s) => ({
          ...s,
          project: { ...s.project, bugDebt: clamp(s.project.bugDebt + 8, 0, 100) },
        }),
      },
    ],
  },

  // ────────── J. 직군·성향 갈등 ──────────
  {
    id: 'qa-vs-dev',
    title: 'QA vs 개발',
    description:
      '"이거 우리 환경에선 재현 안 되는데요." "QA에선 무조건 나는데요." 회의실 분위기가 묘하다.',
    canTrigger: (s) =>
      s.employees.some((e) => e.job === 'qa') && s.employees.some((e) => e.job === 'programmer'),
    choices: [
      {
        label: '같이 디버깅',
        summary: 'QA·개발자 체력 −10, BugDebt −8',
        apply: (s) => {
          const next = {
            ...s,
            project: { ...s.project, bugDebt: clamp(s.project.bugDebt - 8, 0, 100) },
          };
          return {
            ...next,
            employees: next.employees.map((e) =>
              e.job === 'qa' || e.job === 'programmer'
                ? { ...e, stamina: clamp(e.stamina - 10, 0, 100) }
                : e,
            ),
          };
        },
      },
      {
        label: '"환경 차이로 둠"',
        summary: 'QA 사기 −10',
        apply: (s) => applyToJob(s, 'qa', (e) => ({ ...e, morale: clamp(e.morale - 10, 0, 100) })),
      },
    ],
  },
  {
    id: 'progressive-vs-conservative',
    title: '급진파 vs 보수파 충돌',
    description:
      '신기술 도입을 두고 두 진영이 갈렸다. 결정은 한쪽 손을 들어 줘야 한다.',
    canTrigger: (s) => s.productIndex >= 2,
    choices: [
      {
        label: '급진파 손 들기',
        summary: '개발자 효율 +0.05 / 다른 직원 사기 −5',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({
            ...e,
            skill: clamp(e.skill + 0.05, 0, 2),
          }));
          return {
            ...next,
            employees: next.employees.map((e) =>
              e.job !== 'programmer' ? { ...e, morale: clamp(e.morale - 5, 0, 100) } : e,
            ),
          };
        },
      },
      {
        label: '보수파 손 들기',
        summary: '안정 +1주, 모두 사기 +3',
        apply: (s) =>
          applyToAll(
            {
              ...s,
              project: { ...s.project, weeksElapsed: s.project.weeksElapsed + 1 },
            },
            (e) => ({ ...e, morale: clamp(e.morale + 3, 0, 100) }),
          ),
      },
    ],
  },

  // ────────── K. 문화·일상 ──────────
  {
    id: 'team-hoodie',
    title: '후드 팀복 도입 회의',
    description: '"우리도 팀복 하나 만들까요?" 색깔, 로고, 사이즈 조사가 시작된다.',
    choices: [
      {
        label: '제작 진행 (-100g)',
        summary: '모두 사기 +8 (영구 — 입사하면 받음)',
        apply: (s) => {
          if (s.gold < 100) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 100, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + 8, 0, 100) }),
          );
        },
      },
      {
        label: '다음에 (= 영영 안 만듦)',
        summary: '모두 사기 −2',
        apply: (s) => applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - 2, 0, 100) })),
      },
    ],
  },

  // ────────── 조건부 (기존 유지·강화) ──────────
  {
    id: 'overdue-panic',
    title: '연체 패닉',
    description: '예정보다 늦어졌다. 외부에서 압박이 들어온다.',
    canTrigger: (s) => s.project.weeksElapsed > s.project.weeksTarget,
    choices: [
      {
        label: '외주 인력 (-50g)',
        summary: 'BugDebt −8, Progress +3%',
        apply: (s) => {
          if (s.gold < 50) return s;
          return {
            ...s,
            gold: clamp(s.gold - 50, 0, MAX),
            project: {
              ...s.project,
              bugDebt: clamp(s.project.bugDebt - 8, 0, 100),
              progress: clamp(s.project.progress + 3, 0, 100),
            },
          };
        },
      },
      {
        label: '다 같이 야근',
        summary: '모두 체력 −10, Progress +5%',
        apply: (s) =>
          applyToAll(
            { ...s, project: { ...s.project, progress: clamp(s.project.progress + 5, 0, 100) } },
            (e) => ({ ...e, stamina: clamp(e.stamina - 10, 0, 100) }),
          ),
      },
    ],
  },
  {
    id: 'morale-crisis',
    title: '사기 저하 위기',
    description: '팀 분위기가 가라앉았다. 손 안 쓰면 더 떨어진다.',
    canTrigger: (s) => avgMorale(s) < 40,
    choices: [
      {
        label: '회식 강제 (-30g)',
        summary: '모두 사기 +12',
        apply: (s) => {
          if (s.gold < 30) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 30, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + 12, 0, 100) }),
          );
        },
      },
      {
        label: '시간이 약',
        summary: '모두 사기 −3',
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
