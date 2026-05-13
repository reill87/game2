import type { ContentGameEvent } from './shared';
import { MAX, applyToAll, applyToJob, clamp, jit } from './shared';

/** H. 코미디 이벤트 */
export const comedyEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'H',
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
    category: 'H',
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
    category: 'H',
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
  {
    category: 'H',
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
    category: 'H',
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
  {
    category: 'H',
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
    category: 'H',
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
];
