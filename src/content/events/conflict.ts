import type { ContentGameEvent } from './shared';
import { applyByStance, applyToAll, applyToJob, clamp, jit } from './shared';

/** J. 갈등 이벤트 */
export const conflictEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'J',
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
    category: 'J',
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
];
