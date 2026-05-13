import type { ContentGameEvent } from './shared';
import { MAX, applyToAll, applyToJob, clamp, jit } from './shared';

/** F. 외부·산업 이벤트 */
export const industryEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'F',
    id: 'series-funding',
    minProductCount: 6,
    minReputation: 30,
    title: '시리즈 펀딩 라운드',
    description:
      'VC 미팅이 들어왔다. 가치 평가는 좋게 나왔지만, 받으면 다음 분기 KPI 압박이 강해진다.',
    choices: [
      {
        label: '투자 유치 (+200g)',
        summary: '골드 +200 / 모두 사기 −3 (KPI 압박)',
        apply: (s) =>
          applyToAll(
            { ...s, gold: clamp(s.gold + 200, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) }),
          ),
      },
      {
        label: '자체 자금으로 (보수)',
        // 골드 없지만 팀 자율성 유지로 사기 소폭 상승
        summary: '모두 사기 +3 (외압 없음) / BugDebt +4 (인프라 투자 못 함)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
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
    category: 'F',
    id: 'trend-shift',
    minProductCount: 3,
    title: '시장 트렌드 변화',
    description:
      '한 분기 사이 업계 분위기가 또 바뀌었다. AI 봄이라느니, 에이전트가 답이라느니. 우리 프로젝트는 어디에 있나.',
    choices: [
      {
        label: '본업 집중',
        // Progress 오르지만 Appeal은 뒤처짐
        summary: 'Progress +3% / Appeal −3 (트렌드 무시한 이미지)',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            progress: clamp(s.project.progress + jit(3), 0, 100),
            appeal: s.project.appealEnabled
              ? clamp(s.project.appeal - jit(3), 0, MAX)
              : s.project.appeal,
          },
        }),
      },
      {
        label: '트렌드 살짝 반영',
        // Appeal 오르지만 BugDebt 증가
        summary: 'Appeal +5 (트렌디한 이미지) / BugDebt +5 (빠른 구현 부채)',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            appeal: s.project.appealEnabled
              ? clamp(s.project.appeal + jit(5), 0, MAX)
              : s.project.appeal,
            bugDebt: clamp(s.project.bugDebt + jit(5), 0, 100),
          },
        }),
      },
    ],
  },
  {
    category: 'F',
    id: 'tech-conf-booth',
    minProductCount: 8,
    title: '테크 컨퍼런스 부스 제안',
    description: '대형 테크 컨퍼런스에서 부스 자리 제안. 노출은 크지만 비용도 크다.',
    canTrigger: (s) => s.project.appealEnabled && s.gold >= 80,
    choices: [
      {
        label: '부스 참가 (-80g)',
        // 비용+체력 손해 but Appeal 크게 오름
        summary: '−80g, 모두 체력 −5 (준비 피로) / Appeal +12',
        apply: (s) => {
          const next = {
            ...s,
            gold: clamp(s.gold - 80, 0, MAX),
            project: { ...s.project, appeal: clamp(s.project.appeal + jit(12), 0, MAX) },
          };
          return applyToAll(next, (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(5), 0, 100),
          }));
        },
      },
      {
        label: '패스',
        // Appeal 기회 손실은 없지만 경쟁사 대비 인지도 하락
        summary: 'Appeal −4 (경쟁사 대비 노출 부족) / +80g 절약, 체력 소모 없음',
        apply: (s) => ({
          ...s,
          project: {
            ...s.project,
            appeal: s.project.appealEnabled
              ? clamp(s.project.appeal - jit(4), 0, MAX)
              : s.project.appeal,
          },
        }),
      },
    ],
  },
  {
    category: 'F',
    id: 'competitor-release',
    minProductCount: 4,
    title: '경쟁작 출시',
    description: '비슷한 컨셉의 서비스가 막 런칭됐다. 차별화에 박차를 가할까, 신경 끄고 갈까.',
    choices: [
      {
        label: '차별화 박차',
        // Progress 오르지만 BugDebt 증가
        summary: 'Progress +6%, 모두 사기 +3 (자극) / BugDebt +5 (급하게 진행)',
        apply: (s) => {
          const next = {
            ...s,
            project: {
              ...s.project,
              progress: clamp(s.project.progress + jit(6), 0, 100),
              bugDebt: clamp(s.project.bugDebt + jit(5), 0, 100),
            },
          };
          return applyToAll(next, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(3), 0, 100),
          }));
        },
      },
      {
        label: '가던 길',
        // 사기 손해 but BugDebt 안정적
        summary: '모두 사기 −3 (불안감) / BugDebt −3 (서두르지 않음)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
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
    category: 'F',
    id: 'friend-team-launch',
    minProductCount: 10,
    title: '친구 팀 런칭',
    description: '친한 다른 팀이 오늘 출시했다. 우리도 자극을 받는다.',
    choices: [
      {
        label: '자축 회식 (-25g)',
        // 비용+체력 손해 but 사기 오름
        summary: '−25g, 체력 −5 / 모두 사기 +10 (자극과 연대)',
        apply: (s) => {
          if (s.gold < 25) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 25, 0, MAX) },
            (e) => ({
              ...e,
              morale: clamp(e.morale + jit(10), 0, 100),
              stamina: clamp(e.stamina - jit(5), 0, 100),
            }),
          );
        },
      },
      {
        label: '신경 안 씀',
        // 사기 손해 but 집중력 유지로 Progress 소폭 오름
        summary: '모두 사기 −5 (자극 무시) / Progress +2% (흔들리지 않음)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
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
    category: 'F',
    id: 'acquisition-offer',
    minProductCount: 15,
    minReputation: 120,
    title: '스타트업 인수 제안 (우리가 인수자)',
    description:
      '작은 스타트업 팀에서 인수 합병 제안이 들어왔다. 기술력은 있지만 팀 통합 비용이 만만치 않다.',
    choices: [
      {
        label: '제안 거절 (독립 유지)',
        // 모두 사기 오름 + reputation 오름 (독립성 유지)
        summary: '모두 사기 +10 / reputation +10 (독자 노선 신뢰)',
        apply: (s) =>
          applyToAll(
            { ...s, reputation: clamp(s.reputation + 10, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + jit(10), 0, 100) }),
          ),
      },
      {
        label: '협상 테이블만 앉아보기',
        // PM 체력 손해 but 골드 획득 (협상 가치 공유)
        summary: 'PM 체력 −10 (협상 피로) / gold +500 (협상 합의금)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(10), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(500), 0, MAX) };
        },
      },
    ],
  },
  {
    category: 'F',
    id: 'regulator-audit',
    minProductCount: 18,
    title: '규제기관 감사 통보',
    description:
      '개인정보보호위원회에서 감사 통보가 왔다. 협조하거나 법무 대응하거나.',
    choices: [
      {
        label: '전면 협조 (자료 제출)',
        // PM 체력 크게 손해 but BugDebt 소폭 증가 (서류 준비 부담)
        summary: 'PM 체력 −20 (서류 작업) / BugDebt +5 (급한 취약점 패치)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(20), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              bugDebt: clamp(next.project.bugDebt + jit(5), 0, 100),
            },
          };
        },
      },
      {
        label: '법무 대리인 선임 (-300g)',
        // 골드 손해 + 모두 사기 손해 (긴장감)
        summary: '−300g / 모두 사기 −3 (감사 긴장감)',
        apply: (s) => {
          if (s.gold < 300) return s;
          const next = { ...s, gold: clamp(s.gold - 300, 0, MAX) };
          return applyToAll(next, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
        },
      },
    ],
  },
  {
    category: 'F',
    id: 'industry-award',
    minProductCount: 15,
    minReputation: 100,
    title: '업계 어워드 노미네이트',
    description:
      '올해의 혁신 서비스 어워드에 우리가 올랐다. 시상식 참여가 필요하다.',
    choices: [
      {
        label: '시상식 참석',
        // PM 체력 손해 but reputation 크게 오름
        summary: 'PM 체력 −15 (참석 준비) / reputation +15 (업계 인지도)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(15), 0, 100),
          }));
          return { ...next, reputation: clamp(next.reputation + 15, 0, MAX) };
        },
      },
      {
        label: '개발에 집중 (시상식 불참)',
        // PM 사기 손해 but Progress 오름
        summary: 'PM 사기 −5 (아쉬움) / Progress +8% (집중 개발)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return {
            ...next,
            project: {
              ...next.project,
              progress: clamp(next.project.progress + jit(8), 0, 100),
            },
          };
        },
      },
    ],
  },
  {
    category: 'F',
    id: 'series-c-failed',
    minProductCount: 10,
    minReputation: 60,
    title: '시리즈 C 투자 협상 결렬',
    description:
      '"valuation 협의 불발"이라는 메시지와 함께 VC가 텀시트를 거둬들였다. 런웨이 압박이 실감된다.',
    choices: [
      {
        label: '브릿지 파이낸싱 추진',
        summary: '모두 사기 −5 (불안) / BugDebt +3 (긴급 출시 압박)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(3), 0, 100) } };
        },
      },
      {
        label: '자력갱생 (비용 절감 모드)',
        summary: '모두 체력 −5 (긴축) / BugDebt −3 (불필요한 피처 제거)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, stamina: clamp(e.stamina - jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(3), 0, 100) } };
        },
      },
    ],
  },
  {
    category: 'F',
    id: 'patent-troll',
    minProductCount: 12,
    minReputation: 80,
    title: '특허 괴물 침략',
    description:
      '"귀사의 제품이 우리 특허를 침해합니다." 내용증명이 도착했다. 실체 없는 특허 회사다.',
    choices: [
      {
        label: '법무법인에 의뢰 (맞소)',
        summary: '−150g (법무비) / 모두 사기 −3 (스트레스) / BugDebt −2 (코드 리뷰 기회)',
        apply: (s) => {
          const next = applyToAll({ ...s, gold: clamp(s.gold - jit(150), 0, MAX) }, (e) => ({ ...e, morale: clamp(e.morale - jit(3), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(2), 0, 100) } };
        },
      },
      {
        label: '합의금 지불 (조용히 해결)',
        summary: '−80g / 모두 사기 −6 (굴복감)',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(6), 0, 100) })),
          gold: clamp(s.gold - jit(80), 0, MAX),
        }),
      },
    ],
  },
  {
    category: 'F',
    id: 'github-star-50k',
    minProductCount: 8,
    minReputation: 70,
    title: 'GitHub 스타 5만 돌파',
    description:
      '오픈소스 연동 라이브러리가 GitHub 스타 5만을 넘었다. 해외 개발자들의 PR과 이슈가 쏟아진다.',
    choices: [
      {
        label: '컨트리뷰터 웰컴 이벤트 개최',
        summary: '−30g / 모두 사기 +12 (자부심) / +60g (후원 및 스폰십)',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(12), 0, 100) })),
          gold: clamp(s.gold - 30 + jit(60), 0, MAX),
        }),
      },
      {
        label: '조용히 유지 (관리 부담 최소화)',
        summary: '모두 사기 +5 / Progress +3%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(3), 0, 100) } };
        },
      },
    ],
  },
  {
    category: 'F',
    id: 'foreign-vc-visit',
    minProductCount: 10,
    minReputation: 100,
    title: '해외 VC 방문 실사',
    description:
      '실리콘밸리 VC가 실사 방문을 예고했다. 사무실 청소부터 데모 준비까지 주말이 없다.',
    choices: [
      {
        label: '완벽 준비 (전력 투구)',
        summary: '모두 체력 −15 / +200g (투자 의향서) / 모두 사기 +5',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, stamina: clamp(e.stamina - jit(15), 0, 100), morale: clamp(e.morale + jit(5), 0, 100) }));
          return { ...next, gold: clamp(next.gold + jit(200), 0, MAX) };
        },
      },
      {
        label: '있는 그대로 보여주기',
        summary: '모두 사기 +8 (진정성) / +50g',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(8), 0, 100) })),
          gold: clamp(s.gold + jit(50), 0, MAX),
        }),
      },
    ],
  },
  {
    category: 'F',
    id: 'antitrust-investigation',
    minProductCount: 20,
    minReputation: 150,
    title: '공정거래위원회 조사',
    description:
      '"귀사의 시장 지배적 지위 남용 혐의로 조사를 개시합니다." 당신의 회사가 커졌다는 뜻이기도 하다.',
    choices: [
      {
        label: '전면 협조 (법무팀 풀가동)',
        summary: '−200g / 모두 사기 −5 / BugDebt −4 (코드 감사 기회)',
        apply: (s) => {
          const next = applyToAll({ ...s, gold: clamp(s.gold - jit(200), 0, MAX) }, (e) => ({ ...e, morale: clamp(e.morale - jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(4), 0, 100) } };
        },
      },
      {
        label: '최소 대응 (진술만)',
        summary: '모두 사기 −8 (불안) / BugDebt +5',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(8), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(5), 0, 100) } };
        },
      },
    ],
  },
  {
    category: 'F',
    id: 'ipo-roadshow',
    minProductCount: 18,
    minReputation: 200,
    title: 'IPO 로드쇼 준비',
    description:
      'IB 팀이 기관투자자 대상 로드쇼 일정을 잡았다. 창업 이후 최대 이벤트가 코앞이다.',
    choices: [
      {
        label: 'CEO + CFO 풀타임 투입',
        summary: 'PM 체력 −20 / +300g (사전 청약 프리미엄) / 모두 사기 +10',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({ ...e, stamina: clamp(e.stamina - jit(20), 0, 100) }));
          return { ...applyToAll(next, (e) => ({ ...e, morale: clamp(e.morale + jit(10), 0, 100) })), gold: clamp(next.gold + jit(300), 0, MAX) };
        },
      },
      {
        label: '분산 대응 (부서별 담당)',
        summary: '모두 체력 −8 / +120g / Progress −4%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, stamina: clamp(e.stamina - jit(8), 0, 100) }));
          return { ...next, gold: clamp(next.gold + jit(120), 0, MAX), project: { ...next.project, progress: clamp(next.project.progress - jit(4), 0, 100) } };
        },
      },
    ],
  },
  {
    category: 'F',
    id: 'sxsw-keynote',
    minProductCount: 15,
    minReputation: 120,
    title: 'SXSW 키노트 초청',
    description:
      '오스틴 SXSW에서 키노트 발표 초청장이 왔다. 글로벌 무대에 이름을 알릴 찬스.',
    choices: [
      {
        label: '대표 직접 참가 (해외 출장)',
        summary: '−100g (출장비) / 모두 사기 +12 / +150g (파트너십)',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(12), 0, 100) })),
          gold: clamp(s.gold - 100 + jit(150), 0, MAX),
        }),
      },
      {
        label: '영상 메시지 대체 (비용 절감)',
        summary: '모두 사기 +4 / Progress +2%',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(4), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress + jit(2), 0, 100) } };
        },
      },
    ],
  },
];
