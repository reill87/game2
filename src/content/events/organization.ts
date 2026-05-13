import type { ContentGameEvent } from './shared';
import { MAX, applyByStance, applyToAll, applyToJob, avgMorale, clamp, jit } from './shared';

/** D. 조직·HR 이벤트 */
export const organizationEvents: ReadonlyArray<ContentGameEvent> = [
  {
    category: 'D',
    id: 'reorg-quarterly',
    minProductCount: 5,
    title: '분기 조직 개편 통보',
    description:
      '"이번 분기부터 조직이 다음과 같이 재편됩니다." 보고 라인 일부 변경, 팀명 변경. 실체는 같은 사람들.',
    choices: [
      {
        label: '따른다',
        // 적응 사기 손해 but 임원에게 협조적 이미지로 골드 보상
        summary: '모두 사기 −5 (1주 적응) / +30g (협조적 팀 이미지)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(30), 0, MAX) };
        },
      },
      {
        label: 'PM이 대신 항의',
        // PM 사기 큰 손해 but 팀원 사기는 오히려 오름 (PM이 싸워줌)
        summary: 'PM 사기 −10 (혼자 다 맞음) / 팀원 사기 +4 (PM이 지켜줬다)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(10), 0, 100),
          }));
          return {
            ...next,
            employees: next.employees.map((e) =>
              e.job !== 'planner' ? { ...e, morale: clamp(e.morale + jit(4), 0, 100) } : e,
            ),
          };
        },
      },
    ],
  },
  {
    category: 'D',
    id: 'flat-org-rename',
    minProductCount: 10,
    title: '"전 직급 ㅇㅇ님 통일"',
    description:
      '오늘부터 호칭을 모두 통일한다고 한다. 결정은 그대로 위에서 내려오겠지만 형식은 더 수평적이다.',
    choices: [
      {
        label: '바로 적응',
        // 사기 소폭 상승 but conservative 직원은 혼란
        summary: '모두 사기 +1 (잠깐 농담) / conservative 직원 체력 −3 (혼란)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(1), 0, 100),
          }));
          return applyByStance(
            next,
            (e) => e,
            (e) => ({ ...e, stamina: clamp(e.stamina - jit(3), 0, 100) }),
          );
        },
      },
      {
        label: '그냥 박코더 박과장 둘 다 부른다',
        // 팀원 사기 소폭 하락 but PM 체력 손해 없음 (괜한 적응 에너지 불필요)
        summary: '모두 사기 −2 (어색한 이중 호칭) / PM 체력 +2 (아무것도 바꾸지 않음)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
          }));
          return applyToJob(next, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina + jit(2), 0, 100),
          }));
        },
      },
    ],
  },
  {
    category: 'D',
    id: 'new-exec-onboarding',
    minProductCount: 8,
    title: '신임 임원 합류',
    description:
      '신임 임원이 방금 합류했다. 첫 분기에 대대적인 변화를 예고하고 있다. 모든 정책이 reset 될지 모른다.',
    choices: [
      {
        label: '환영 분위기 맞추기',
        // 팀 사기 손해 but 임원 관계 구축으로 골드 확보
        summary: '모두 사기 −3 (진심 아닌 환영) / +40g (임원 첫인상 관리)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
          return { ...next, gold: clamp(next.gold + jit(40), 0, MAX) };
        },
      },
      {
        label: '조용히 본업',
        // 사기 손해 적지만 기능 진행으로 Progress 소폭 오름
        summary: '모두 사기 −2 (눈치 보임) / Progress +2% (본업 집중)',
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
    category: 'D',
    id: 'exit-interview',
    minProductCount: 4,
    minReputation: 20,
    title: '퇴사 면담 요청',
    description: '한 직원이 따로 1:1을 요청해 왔다. 평소 사기가 많이 떨어져 있던 사람이다.',
    canTrigger: (s) => avgMorale(s) < 40,
    choices: [
      {
        label: '카운터 오퍼 (-150g)',
        summary: '모두 사기 +15 (분위기 회복) / 골드 압박 −150g',
        apply: (s) => {
          if (s.gold < 150) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 150, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + jit(15), 0, 100) }),
          );
        },
      },
      {
        label: '본인 결정 존중 (= 떠남)',
        // 직원 퇴사 but 남은 팀원 사기 소폭 오름 (퇴사 자유 존중 분위기)
        summary: '가장 사기 낮은 1명 퇴사 / 남은 팀원 사기 +3 (의사 존중)',
        apply: (s) => {
          if (s.employees.length <= 2) return s; // 너무 적으면 보호
          let lowestIdx = 0;
          for (let i = 1; i < s.employees.length; i++) {
            const a = s.employees[i];
            const b = s.employees[lowestIdx];
            if (a && b && a.morale < b.morale) lowestIdx = i;
          }
          const afterLeave = {
            ...s,
            employees: s.employees.filter((_, i) => i !== lowestIdx),
            assignment: Object.fromEntries(
              Object.entries(s.assignment).filter(
                ([, id]) => id !== s.employees[lowestIdx]?.id,
              ),
            ),
          };
          return applyToAll(afterLeave, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(3), 0, 100),
          }));
        },
      },
    ],
  },
  {
    category: 'D',
    id: 'quarterly-dinner',
    minProductCount: 2,
    title: '분기 회식',
    description: '분기 마감 기념 회식 안내가 단톡에 떴다. "강제 아닙니다" 이모지와 함께.',
    choices: [
      {
        label: '쏜다 (-50g)',
        summary: '모두 사기 +12 / 다음 날 체력 −5',
        apply: (s) => {
          if (s.gold < 50) return s;
          return applyToAll(
            { ...s, gold: clamp(s.gold - 50, 0, MAX) },
            (e) => ({
              ...e,
              morale: clamp(e.morale + jit(12), 0, 100),
              stamina: clamp(e.stamina - jit(5), 0, 100),
            }),
          );
        },
      },
      {
        label: '오늘은 패스',
        // 사기 손해 but 체력 절약 + 비용 절약
        summary: '모두 사기 −2 / 체력 +3 (일찍 귀가), +50g 절약',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(2), 0, 100),
            stamina: clamp(e.stamina + jit(3), 0, 100),
          })),
      },
    ],
  },
  {
    category: 'D',
    id: 'culture-survey',
    minProductCount: 8,
    title: '문화 설문 결과 공유 회의',
    description:
      '익명 문화 설문 결과가 나왔다. 불편한 숫자들이 슬라이드에 가득하다. PM이 발표자다.',
    choices: [
      {
        label: '솔직하게 공유 (불편해도)',
        // PM 사기 손해 but 다른 모두 사기 오름 (신뢰 상승)
        summary: 'PM 사기 −5 (현장 화살받이) / 다른 직원 사기 +8 (투명한 문화)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(5), 0, 100),
          }));
          return {
            ...next,
            employees: next.employees.map((e) =>
              e.job !== 'planner' ? { ...e, morale: clamp(e.morale + jit(8), 0, 100) } : e,
            ),
          };
        },
      },
      {
        label: '칭찬 위주로 편집 (선택적 공유)',
        // 모두 사기 소폭 오름 but reputation 손해 (다음 설문에서 냉소 누적)
        summary: '모두 사기 +3 (분위기 좋음) / reputation −5 (냉소 누적)',
        apply: (s) =>
          applyToAll(
            { ...s, reputation: clamp(s.reputation - 5, 0, MAX) },
            (e) => ({ ...e, morale: clamp(e.morale + jit(3), 0, 100) }),
          ),
      },
    ],
  },
  {
    category: 'D',
    id: 'mandatory-csr',
    minProductCount: 12,
    minReputation: 60,
    title: '의무 봉사활동 공지',
    description:
      '회사에서 분기별 의무 사회공헌 활동 참여를 공지했다. 참여할까, 면제 신청을 넣을까.',
    choices: [
      {
        label: '다 같이 참여',
        // 모두 체력 손해 but 사기 소폭 오름 (의미 있는 경험)
        summary: '모두 체력 −10 / 모두 사기 +5 (뜻 깊은 하루)',
        apply: (s) =>
          applyToAll(s, (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(10), 0, 100),
            morale: clamp(e.morale + jit(5), 0, 100),
          })),
      },
      {
        label: 'PM이 면제 신청 처리',
        // PM 체력 손해 (서류 처리) + 모두 사기 소폭 손해
        summary: 'PM 체력 −10 (면제 신청 처리) / 모두 사기 −3 (의무 빼기 찜찜함)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            stamina: clamp(e.stamina - jit(10), 0, 100),
          }));
          return applyToAll(next, (e) => ({
            ...e,
            morale: clamp(e.morale - jit(3), 0, 100),
          }));
        },
      },
    ],
  },
  {
    category: 'D',
    id: 'town-hall-q',
    minProductCount: 15,
    title: '타운홀 Q&A 시간',
    description:
      '전사 타운홀에서 Q&A가 시작됐다. 팀원이 꽤 날카로운 질문을 던졌다. PM이 마이크를 잡았다.',
    choices: [
      {
        label: '직설적으로 답변',
        // 모두 사기 크게 오름 but PM 사기 손해 (뒤탈)
        summary: '모두 사기 +12 (통쾌한 답변) / PM 사기 −10 (뒤탈 각오)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({
            ...e,
            morale: clamp(e.morale + jit(12), 0, 100),
          }));
          return applyToJob(next, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale - jit(10), 0, 100),
          }));
        },
      },
      {
        label: '외교적으로 돌려 말하기',
        // PM 사기 오름 but 모두 사기 소폭 손해 (실망)
        summary: 'PM 사기 +5 (안전한 답변) / 모두 사기 −3 (또 저러네)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({
            ...e,
            morale: clamp(e.morale + jit(5), 0, 100),
          }));
          return applyToAll(next, (e) =>
            e.job !== 'planner' ? { ...e, morale: clamp(e.morale - jit(3), 0, 100) } : e,
          );
        },
      },
    ],
  },
  {
    category: 'D',
    id: 'q4-bonus-cut',
    minProductCount: 6,
    title: '연말 보너스 삭감 통보',
    description:
      '"올해 실적이 아쉬워 연말 보너스를 축소합니다." CFO 이메일 한 줄이 사무실을 얼어붙혔다.',
    choices: [
      {
        label: '팀장이 위에 강하게 항의',
        summary: 'PM 사기 −10 (소모) / 팀원 사기 +5 (PM이 싸워줌)',
        apply: (s) => {
          const next = applyToJob(s, 'planner', (e) => ({ ...e, morale: clamp(e.morale - jit(10), 0, 100) }));
          return { ...next, employees: next.employees.map((e) => e.job !== 'planner' ? { ...e, morale: clamp(e.morale + jit(5), 0, 100) } : e) };
        },
      },
      {
        label: '조용히 수용 (현실이다)',
        summary: '모두 사기 −8 (낙심) / BugDebt +4 (의욕 저하)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(8), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(4), 0, 100) } };
        },
      },
    ],
  },
  {
    category: 'D',
    id: 'parental-leave-policy',
    minProductCount: 8,
    title: '육아휴직 확대 정책 도입',
    description:
      'HR이 육아휴직을 최대 2년으로 확대하는 안을 들고 왔다. 좋은 문화지만 단기 인력 공백이 생긴다.',
    choices: [
      {
        label: '전격 도입 공표',
        summary: '모두 사기 +8 (문화 자부심) / Progress −5% (일부 인력 공백)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(8), 0, 100) }));
          return { ...next, project: { ...next.project, progress: clamp(next.project.progress - jit(5), 0, 100) } };
        },
      },
      {
        label: '단계적 검토 (내년부터)',
        summary: '모두 사기 −2 (실망) / BugDebt −2 (안정적 스프린트)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(2), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt - jit(2), 0, 100) } };
        },
      },
    ],
  },
  {
    category: 'D',
    id: 'unionization-talk',
    minProductCount: 10,
    title: '노조 결성 논의',
    description:
      '직원 일부가 조합 결성을 논의 중이라는 소문이 돌고 있다. 경영진은 긴장하고 있다.',
    choices: [
      {
        label: '열린 대화 채널 제공',
        summary: '모두 사기 +6 (신뢰) / +30g (갈등 예방)',
        apply: (s) => ({
          ...applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale + jit(6), 0, 100) })),
          gold: clamp(s.gold + jit(30), 0, MAX),
        }),
      },
      {
        label: '모른 척 (알아서 꺼지겠지)',
        summary: '모두 사기 −5 / BugDebt +4 (긴장감)',
        apply: (s) => {
          const next = applyToAll(s, (e) => ({ ...e, morale: clamp(e.morale - jit(5), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(4), 0, 100) } };
        },
      },
    ],
  },
  {
    category: 'D',
    id: 'industry-poach-attempt',
    minProductCount: 12,
    minReputation: 90,
    title: '대기업 인재 스카웃 시도',
    description:
      '경쟁사 대기업이 우리 핵심 시니어 개발자에게 연봉 2배를 제시했다는 얘기가 들어왔다.',
    choices: [
      {
        label: '리텐션 패키지 제공 (-200g)',
        summary: '−200g / 해당 개발자 사기 +20 / 모두 사기 +5',
        apply: (s) => {
          if (s.gold < 200) return s;
          return {
            ...applyToAll({ ...s, gold: clamp(s.gold - 200, 0, MAX) }, (e) =>
              e.job === 'programmer' ? { ...e, morale: clamp(e.morale + jit(20), 0, 100) } : { ...e, morale: clamp(e.morale + jit(5), 0, 100) },
            ),
          };
        },
      },
      {
        label: '개인 결정에 맡긴다',
        summary: '개발자 사기 −15 (배신감?) / BugDebt +6',
        apply: (s) => {
          const next = applyToJob(s, 'programmer', (e) => ({ ...e, morale: clamp(e.morale - jit(15), 0, 100) }));
          return { ...next, project: { ...next.project, bugDebt: clamp(next.project.bugDebt + jit(6), 0, 100) } };
        },
      },
    ],
  },
];
