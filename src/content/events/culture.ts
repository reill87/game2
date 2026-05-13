import type { ContentGameEvent } from './shared';
import { MAX, applyToAll, applyToJob, clamp, jit } from './shared';

/** G. 일상 이벤트 */
export const cultureEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'G',
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
    category: 'G',
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
  {
    category: 'G',
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
    category: 'G',
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
  {
    category: 'G',
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
    category: 'G',
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
];
