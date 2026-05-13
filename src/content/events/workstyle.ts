import type { ContentGameEvent } from './shared';
import { MAX, applyToAll, applyToJob, avgMorale, clamp, jit } from './shared';

/** K. 문화 이벤트 */
export const workstyleEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'K',
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
    category: 'K',
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
    category: 'K',
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
    category: 'K',
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
  {
    category: 'K',
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
    category: 'K',
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
  {
    category: 'K',
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
    category: 'K',
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
