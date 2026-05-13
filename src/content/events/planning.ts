import type { ContentGameEvent } from './shared';
import { MAX, applyToAll, applyToJob, clamp, jit } from './shared';

/** B. 기획·스코프 이벤트 */
export const planningEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'B',
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
    category: 'B',
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
    category: 'B',
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
  {
    category: 'B',
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
    category: 'B',
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
  {
    category: 'B',
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
];
