import type { ContentGameEvent } from './shared';
import { MAX, applyByStance, applyToAll, applyToJob, clamp, jit } from './shared';

/** C. 개발·기술 이벤트 */
export const engineeringEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'C',
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
    category: 'C',
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
    category: 'C',
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
    category: 'C',
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
    category: 'C',
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
  {
    category: 'C',
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
    category: 'C',
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
    category: 'C',
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
  {
    category: 'C',
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
    category: 'C',
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
    category: 'C',
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
];
