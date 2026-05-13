import type { ContentGameEvent } from './shared';
import { MAX, applyToAll, applyToJob, clamp, jit } from './shared';

/** A. 의사소통 이벤트 */
export const communicationEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'A',
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
    category: 'A',
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
  {
    category: 'A',
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
    category: 'A',
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
    category: 'A',
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
  {
    category: 'A',
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
    category: 'A',
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
    category: 'A',
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
    category: 'A',
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
];
