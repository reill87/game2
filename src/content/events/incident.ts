import type { ContentGameEvent } from './shared';
import { MAX, applyToAll, applyToJob, clamp, jit } from './shared';

/** I. 사고 이벤트 */
export const incidentEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'I',
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
                ? clamp(s.project.appeal + jit(5), 0, MAX)
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
              appeal: clamp(s.project.appeal - jit(5), 0, MAX),
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
    category: 'I',
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
  {
    category: 'I',
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
  {
    category: 'I',
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
    category: 'I',
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
];
