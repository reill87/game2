import type { ContentGameEvent } from './shared';
import { MAX, applyToAll, applyToJob, clamp, jit } from './shared';

/** E. 출시·운영 이벤트 */
export const launchEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'E',
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
    category: 'E',
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
                ? clamp(s.project.appeal + jit(3), 0, MAX)
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
              appeal: clamp(s.project.appeal - jit(3), 0, MAX),
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
  {
    category: 'E',
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
    category: 'E',
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
  {
    category: 'E',
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
    category: 'E',
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
    category: 'E',
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
];
