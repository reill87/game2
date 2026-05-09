/**
 * 메일 시스템 — NPC가 발송하는 메일 템플릿 + 수신 메일 타입 + 발송 로직.
 * noUncheckedIndexedAccess 준수: 배열 인덱스 접근 시 옵셔널 처리.
 */
import type { GameState } from './types';
import type { NpcId } from './npcs';
import { NPCS } from './npcs';

/** 수신된 메일 하나. */
export interface MailMessage {
  readonly id: string;
  readonly fromNpcId: NpcId;
  readonly subject: string;
  readonly body: string;
  /** 받은 시각(epoch ms). */
  readonly receivedAt: number;
  readonly read: boolean;
  /** 행동 옵션 — 없으면 정보 메일(닫기만). */
  readonly choices?: ReadonlyArray<{
    readonly label: string;
    readonly summary: string;
    readonly apply: (state: GameState) => GameState;
  }>;
}

/** 메일 템플릿 — NPC가 발송 가능한 메일 정의. */
export interface MailTemplate {
  readonly id: string;
  readonly fromNpcId: NpcId;
  readonly subject: string;
  readonly body: string;
  /** 발송 최소 출시 횟수. */
  readonly minProductCount?: number;
  /** 발송 최소 명성. */
  readonly minReputation?: number;
  /** 추가 발송 조건 (선택). */
  readonly canTrigger?: (state: GameState) => boolean;
  /** 행동 선택지 — 없으면 정보 메일. */
  readonly choices?: ReadonlyArray<{
    readonly label: string;
    readonly summary: string;
    readonly apply: (state: GameState) => GameState;
  }>;
}

// ────────────────────────── 메일 카탈로그 ──────────────────────────

/** 직원 사기 변경 헬퍼 — 모든 직원의 morale에 delta 적용(0~100 클램프). */
function adjustAllMorale(state: GameState, delta: number): GameState {
  return {
    ...state,
    employees: state.employees.map((e) => ({
      ...e,
      morale: Math.max(0, Math.min(100, e.morale + delta)),
    })),
  };
}

/** PM(첫 번째 직원) 체력 변경 헬퍼 — 없으면 state 그대로 반환. */
function adjustPmStamina(state: GameState, delta: number): GameState {
  const pm = state.employees[0];
  if (!pm) return state;
  return {
    ...state,
    employees: state.employees.map((e, i) =>
      i === 0
        ? { ...e, stamina: Math.max(0, Math.min(100, e.stamina + delta)) }
        : e,
    ),
  };
}

/** PM(첫 번째 직원) 사기 변경 헬퍼. */
function adjustPmMorale(state: GameState, delta: number): GameState {
  const pm = state.employees[0];
  if (!pm) return state;
  return {
    ...state,
    employees: state.employees.map((e, i) =>
      i === 0
        ? { ...e, morale: Math.max(0, Math.min(100, e.morale + delta)) }
        : e,
    ),
  };
}

/** PM skill 변경 헬퍼. */
function adjustPmSkill(state: GameState, delta: number): GameState {
  const pm = state.employees[0];
  if (!pm) return state;
  return {
    ...state,
    employees: state.employees.map((e, i) =>
      i === 0
        ? { ...e, skill: Math.max(0.1, e.skill + delta) }
        : e,
    ),
  };
}

export const MAIL_TEMPLATES: ReadonlyArray<MailTemplate> = [
  // ──────── rival-ceo (3) ────────
  {
    id: 'rival-ceo-brag',
    fromNpcId: 'rival-ceo',
    subject: '저희도 오늘 출시했습니다',
    body: '안녕하세요. 이라이벌입니다. 저희 팀도 오늘 신작을 출시했어요. 매출은 아직 집계 중이지만 리뷰 반응이 좋네요. 참고하세요.',
    minProductCount: 5,
    // 선택지 없음 — 정보 메일
  },
  {
    id: 'rival-ceo-collab',
    fromNpcId: 'rival-ceo',
    subject: '업무 협업 제안드립니다',
    body: '안녕하세요. 이라이벌 대표입니다. 요즘 시장이 빠르게 변하고 있습니다. 서로 시너지를 낼 수 있는 협업을 제안드립니다. 검토해 주시겠습니까?',
    minProductCount: 5,
    choices: [
      {
        label: 'A) 수락 — 골드 +200, 명성 −10',
        summary: '단기 자금을 얻지만 독립성 이미지가 흔들립니다.',
        apply: (state) => ({
          ...state,
          gold: state.gold + 200,
          reputation: Math.max(0, state.reputation - 10),
        }),
      },
      {
        label: 'B) 거절 — 명성 +5',
        summary: '자체 역량을 지켰다는 이미지로 명성이 소폭 상승합니다.',
        apply: (state) => ({
          ...state,
          reputation: state.reputation + 5,
        }),
      },
    ],
  },
  {
    id: 'rival-ceo-poaching',
    fromNpcId: 'rival-ceo',
    subject: '귀사 직원 영입을 시도하고 있습니다',
    body: '솔직히 말씀드리겠습니다. 저희 팀이 귀사의 인재를 눈여겨보고 있습니다. 협상 여지가 있다면 연락 주세요.',
    minProductCount: 7,
    choices: [
      {
        label: 'A) 협상 — 골드 −150 (리텐션 패키지)',
        summary: '골드를 써서 직원들을 붙잡습니다.',
        apply: (state) => ({
          ...state,
          gold: Math.max(0, state.gold - 150),
        }),
      },
      {
        label: 'B) 무시 — PM 사기 −20',
        summary: '직원들이 불안감을 느끼며 사기가 떨어집니다.',
        apply: (state) => adjustPmMorale(state, -20),
      },
    ],
  },

  // ──────── angel-investor (2) ────────
  {
    id: 'angel-quarterly-report',
    fromNpcId: 'angel-investor',
    subject: '이번 분기 매출 보고 부탁드립니다',
    body: '안녕하세요 김엔젤입니다. 슬슬 분기 결산 시즌이네요. 간단한 매출 보고를 보내주시면 좋겠습니다. 투자자 입장에서 현황 파악이 필요합니다.',
    minProductCount: 3,
    choices: [
      {
        label: 'A) 보고 제출 — PM 체력 −10, 팀 사기 +3',
        summary: 'PM이 보고서를 준비하느라 지치지만 팀이 긍정 피드백을 받습니다.',
        apply: (state) => adjustPmStamina(adjustAllMorale(state, 3), -10),
      },
      {
        label: 'B) 미루기 — 팀 사기 +3, 명성 −5',
        summary: '팀은 여유롭지만 투자자 신뢰가 소폭 하락합니다.',
        apply: (state) => ({
          ...adjustAllMorale(state, 3),
          reputation: Math.max(0, state.reputation - 5),
        }),
      },
    ],
  },
  {
    id: 'angel-new-investment',
    fromNpcId: 'angel-investor',
    subject: '추가 투자를 제안합니다',
    body: '사업이 성장하고 있군요. 추가로 500 골드 투자를 제안드립니다. 대신 성과 압박은 조금 생길 수 있습니다.',
    minProductCount: 5,
    choices: [
      {
        label: 'A) 수락 — 골드 +500, 명성 −5',
        summary: '자금 확보, 하지만 외부 압박 이미지 영향.',
        apply: (state) => ({
          ...state,
          gold: state.gold + 500,
          reputation: Math.max(0, state.reputation - 5),
        }),
      },
      {
        label: 'B) 거절 — 명성 +5',
        summary: '독립 경영 의지를 보여 명성 상승.',
        apply: (state) => ({
          ...state,
          reputation: state.reputation + 5,
        }),
      },
    ],
  },

  // ──────── exec-coach (2) ────────
  {
    id: 'exec-coach-workshop',
    fromNpcId: 'exec-coach',
    subject: '팀 빌딩 워크샵 추천드립니다',
    body: '박코치입니다. 팀 결속력을 높이는 워크샵 프로그램을 추천드립니다. 골드 투자가 필요하지만 효과는 확실합니다.',
    minProductCount: 8,
    minReputation: 50,
    choices: [
      {
        label: 'A) 도입 — 골드 −150, 팀 사기 +20',
        summary: '비용이 들지만 팀 전체 사기가 크게 상승합니다.',
        apply: (state) => ({
          ...adjustAllMorale(state, 20),
          gold: Math.max(0, state.gold - 150),
        }),
      },
      {
        label: 'B) 패스 — PM 사기 −5',
        summary: 'PM이 아쉬워하며 사기가 소폭 하락합니다.',
        apply: (state) => adjustPmMorale(state, -5),
      },
    ],
  },
  {
    id: 'exec-coach-1on1',
    fromNpcId: 'exec-coach',
    subject: '리더십 1on1 미팅 제안',
    body: '박코치입니다. 리더십 코칭 1on1을 진행하고 싶습니다. 시간이 소요되지만 PM의 역량 향상에 도움이 됩니다.',
    minProductCount: 10,
    minReputation: 50,
    choices: [
      {
        label: 'A) 참여 — PM 체력 −20, PM skill +0.05',
        summary: 'PM이 지치지만 실력이 한층 성장합니다.',
        apply: (state) => adjustPmSkill(adjustPmStamina(state, -20), 0.05),
      },
      {
        label: 'B) 패스 — PM 사기 −5',
        summary: 'PM이 성장 기회를 놓쳐 아쉬워합니다.',
        apply: (state) => adjustPmMorale(state, -5),
      },
    ],
  },

  // ──────── venture-capital (2) ────────
  {
    id: 'vc-series-a',
    fromNpcId: 'venture-capital',
    subject: '시리즈 A 투자 제안드립니다',
    body: 'VC 정대표입니다. 귀사의 성장 잠재력을 높이 평가합니다. 시리즈 A 투자를 제안드립니다. 단, 기술 부채 감수가 필요합니다.',
    minProductCount: 12,
    minReputation: 100,
    choices: [
      {
        label: 'A) 수락 — 골드 +2000, 명성 +20, BugDebt +15',
        summary: '대규모 자금과 명성을 얻지만 기술 부채가 증가합니다.',
        apply: (state) => ({
          ...state,
          gold: state.gold + 2000,
          reputation: state.reputation + 20,
          project: {
            ...state.project,
            bugDebt: Math.min(100, state.project.bugDebt + 15),
          },
        }),
      },
      {
        label: 'B) 거절 — 팀 사기 +5',
        summary: '독립 경영을 선택한 팀이 뭉칩니다.',
        apply: (state) => adjustAllMorale(state, 5),
      },
    ],
  },
  {
    id: 'vc-board-seat',
    fromNpcId: 'venture-capital',
    subject: '이사회 합류 요청',
    body: 'VC 정대표입니다. 귀사 이사회에 합류하고 싶습니다. 추가 자금 지원이 가능하지만 경영 관여가 늘어납니다.',
    minProductCount: 14,
    minReputation: 100,
    choices: [
      {
        label: 'A) 수락 — PM 체력 −30, 골드 +500',
        summary: 'PM이 이사회 대응으로 지치지만 자금을 확보합니다.',
        apply: (state) => ({
          ...adjustPmStamina(state, -30),
          gold: state.gold + 500,
        }),
      },
      {
        label: 'B) 거절 — PM 사기 +10',
        summary: '독립 의지로 PM 사기가 상승합니다.',
        apply: (state) => adjustPmMorale(state, 10),
      },
    ],
  },

  // ──────── gov-regulator (2) ────────
  {
    id: 'gov-data-regulation',
    fromNpcId: 'gov-regulator',
    subject: '데이터 규제 시행 안내',
    body: '안녕하세요. 개인정보보호위원회입니다. 신규 데이터 규제가 시행됩니다. 컴플라이언스 조치를 취하시기 바랍니다.',
    minProductCount: 10,
    choices: [
      {
        label: 'A) 컴플라이언스 — 골드 −200, BugDebt −10%',
        summary: '비용을 들여 규정을 준수하면 기술 부채가 줄어듭니다.',
        apply: (state) => ({
          ...state,
          gold: Math.max(0, state.gold - 200),
          project: {
            ...state.project,
            bugDebt: Math.max(0, state.project.bugDebt - 10),
          },
        }),
      },
      {
        label: 'B) 일단 무시 — 명성 −10, BugDebt +5',
        summary: '규제를 무시하면 명성이 떨어지고 기술 부채가 쌓입니다.',
        apply: (state) => ({
          ...state,
          reputation: Math.max(0, state.reputation - 10),
          project: {
            ...state.project,
            bugDebt: Math.min(100, state.project.bugDebt + 5),
          },
        }),
      },
    ],
  },
  {
    id: 'gov-tax-audit',
    fromNpcId: 'gov-regulator',
    subject: '세무 조사 통보',
    body: '국세청입니다. 귀사에 대한 정기 세무 조사를 실시할 예정입니다. 관련 서류를 준비해 주시기 바랍니다.',
    minProductCount: 12,
    choices: [
      {
        label: 'A) 협조 — PM 체력 −20, 골드 −300',
        summary: 'PM이 서류 준비로 지치고 세금 납부 비용이 발생합니다.',
        apply: (state) => ({
          ...adjustPmStamina(state, -20),
          gold: Math.max(0, state.gold - 300),
        }),
      },
      {
        label: 'B) 변호사 선임 — 골드 −500, 명성 +5',
        summary: '고비용이지만 PM 부담이 없고 전문 대응으로 명성이 소폭 상승.',
        apply: (state) => ({
          ...state,
          gold: Math.max(0, state.gold - 500),
          reputation: state.reputation + 5,
        }),
      },
    ],
  },

  // ──────── tech-blogger (2) ────────
  {
    id: 'blogger-interview',
    fromNpcId: 'tech-blogger',
    subject: '인터뷰 요청드립니다',
    body: '테크블로거 한리뷰입니다. 귀사 개발 문화와 최신 제품에 대해 인터뷰를 하고 싶습니다. 시간 내주실 수 있나요?',
    minProductCount: 6,
    choices: [
      {
        label: 'A) 수락 — PM 체력 −10, 명성 +15',
        summary: '인터뷰 준비로 PM이 지치지만 기사 효과로 명성이 상승합니다.',
        apply: (state) => ({
          ...adjustPmStamina(state, -10),
          reputation: state.reputation + 15,
        }),
      },
      {
        label: 'B) 거절 — 명성 −5',
        summary: '블로거가 실망해 짧은 부정 언급을 남깁니다.',
        apply: (state) => ({
          ...state,
          reputation: Math.max(0, state.reputation - 5),
        }),
      },
    ],
  },
  {
    id: 'blogger-backlash',
    fromNpcId: 'tech-blogger',
    subject: '악플 시리즈 발견',
    body: '한리뷰입니다. 커뮤니티에서 귀사 제품에 대한 악플 시리즈가 올라오고 있습니다. 대응을 고려해 보세요.',
    minProductCount: 8,
    choices: [
      {
        label: 'A) 공식 대응 — PM 체력 −15, 명성 +5',
        summary: 'PM이 공식 입장문을 준비하며 지치지만 명성을 회복합니다.',
        apply: (state) => ({
          ...adjustPmStamina(state, -15),
          reputation: state.reputation + 5,
        }),
      },
      {
        label: 'B) 무시 — 팀 사기 −5',
        summary: '악플을 방치하자 팀 분위기가 나빠집니다.',
        apply: (state) => adjustAllMorale(state, -5),
      },
    ],
  },
];

// ────────────────────────── 발송 로직 ──────────────────────────

/**
 * 현재 GameState에서 발송 가능한 메일 템플릿 중 하나를 랜덤 선택.
 * recentIds: 최근 발송된 메일 ID 목록 — 중복 방지.
 * 조건 미충족 또는 후보 없으면 null.
 */
export function pickRandomMail(
  state: GameState,
  recentIds: ReadonlyArray<string>,
): MailTemplate | null {
  const productCount = state.productIndex + 1;
  const reputation = state.reputation;

  // 발송 가능 NPC id 집합 — NPC 자체 minProductCount / minReputation 필터.
  const eligibleNpcIds = new Set(
    NPCS.filter(
      (npc) =>
        productCount >= npc.minProductCount &&
        (npc.minReputation === undefined || reputation >= npc.minReputation),
    ).map((npc) => npc.id),
  );

  // 후보 필터: NPC 조건 + 템플릿 자체 조건 + 최근 중복 제외.
  const recentSet = new Set(recentIds);
  const candidates = MAIL_TEMPLATES.filter((tpl) => {
    if (!eligibleNpcIds.has(tpl.fromNpcId)) return false;
    if (tpl.minProductCount !== undefined && productCount < tpl.minProductCount) return false;
    if (tpl.minReputation !== undefined && reputation < tpl.minReputation) return false;
    if (tpl.canTrigger && !tpl.canTrigger(state)) return false;
    if (recentSet.has(tpl.id)) return false;
    return true;
  });

  if (candidates.length === 0) return null;
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx] ?? null;
}

/** MailTemplate → MailMessage 변환 (고유 id 생성 포함). */
export function createMailMessage(tpl: MailTemplate, receivedAt: number): MailMessage {
  return {
    id: `${tpl.id}-${receivedAt}`,
    fromNpcId: tpl.fromNpcId,
    subject: tpl.subject,
    body: tpl.body,
    receivedAt,
    read: false,
    choices: tpl.choices,
  };
}

/** 메일 읽음 처리. */
export function markMailRead(
  mails: ReadonlyArray<MailMessage>,
  mailId: string,
): ReadonlyArray<MailMessage> {
  return mails.map((m) => (m.id === mailId ? { ...m, read: true } : m));
}

/** 메일 큐 cap — 오래된 것부터 삭제. */
export const MAIL_CAP = 30;

/** cap 초과 시 오래된 메일 정리. */
export function trimMails(mails: ReadonlyArray<MailMessage>): ReadonlyArray<MailMessage> {
  if (mails.length <= MAIL_CAP) return mails;
  return [...mails].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, MAIL_CAP);
}
