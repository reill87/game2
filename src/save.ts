/**
 * 단일 슬롯 localStorage 저장. 키는 schema family('game2.save')로 두고
 * 데이터의 version 필드로 버전을 식별한다(키 이름이 거짓말하지 않게).
 *
 *  - 'game2.save'         : 현재(쓰기/읽기 1순위)
 *  - 'game2.save.v1'      : slice 3 호환용 — fallback 읽기 후 제거
 *  - 'game2.save.unknown' : 인식 못한 데이터의 백업 (사용자 데이터 손실 방지)
 *
 * 실패(스토리지 비활성·할당 초과·JSON 깨짐)는 모두 null로 흡수해 게임 흐름을 막지 않는다.
 *
 * 마이그레이션 정책:
 *  - v1 데이터를 그대로 받아 productCount=0, officeLevel=1, hiredEmployees=[]로 보강한다.
 *  - 미인식 버전은 'game2.save.unknown'에 백업한 뒤 null 반환 (사용자에게는 "저장 없음"으로 보임).
 */
import { CONDITION } from './domain/balance';
import { MILESTONES, type MilestoneId } from './domain/milestones';
import { EMPTY_RND, type RndId, type RndState, type RndProgress } from './domain/rnd';
import type { EconomyState } from './domain/economy';
import {
  EMPTY_FACILITIES,
  VALID_FACILITY_IDS,
  type FacilityId,
  type FacilityState,
} from './domain/facilities';
import {
  MARKETS,
  type MarketId,
  type MarketState,
} from './domain/markets';
import {
  ACQUISITIONS,
  type AcquisitionId,
  type AcquisitionState,
} from './domain/acquisitions';
import type { EmployeeEquipment, EquipmentSlot } from './domain/equipment';
import type {
  CompanyPolicy,
  Employee,
  Job,
  OfficeLevel,
  Rank,
  Stance,
  Track,
  Trait,
  TrendStatus,
} from './domain/types';
import type { MailMessage } from './domain/mail';
import type { NpcId } from './domain/npcs';
import type { BankruptcyState } from './domain/bankruptcy';
import type { ExecState } from './domain/exec';
import { EMPTY_RIVALS, type RivalState, type RivalRelease, RIVALS } from './domain/rivals';
import type { RivalId } from './domain/rivals';

const KEY = 'game2.save';
const LEGACY_KEY_V1 = 'game2.save.v1';
const UNKNOWN_BACKUP_KEY = 'game2.save.unknown';
/** 프레스티지 회수 전용 키 — clearData(메인 키 삭제)와 독립적으로 보존. */
const PRESTIGE_KEY = 'game2.prestige';

export interface SavedResult {
  readonly genre: string;
  readonly theme: string;
  readonly weeksElapsed: number;
  readonly weeksTarget: number;
  readonly bugDebt: number;
  readonly reviewScore: number;
  readonly stars: number;
  readonly revenue: number;
  readonly polishCount: number;
  /** 출시 시각(epoch ms) — 누적 통계 정렬·표시용. 옛 데이터엔 없을 수 있어 옵셔널. */
  readonly releasedAt?: number;
}

export interface SaveData {
  readonly version: 2;
  readonly savedAt: number;
  readonly gold: number;
  readonly productCount: number;
  readonly officeLevel: OfficeLevel;
  readonly hiredEmployees: ReadonlyArray<Employee>;
  readonly lastResult: SavedResult | null;
  /** 회사 누적 명성 — PIVOT-4. 옛 v2 데이터엔 없을 수 있어 옵셔널 취급. */
  readonly reputation?: number;
  /** 회사 정책 — PIVOT-5. 옛 데이터엔 없으므로 옵셔널, default로 보강. */
  readonly policy?: CompanyPolicy;
  /** 시장 트렌드 — PIVOT-6. null/undefined면 Boot에서 새 트렌드 pick. */
  readonly trend?: TrendStatus | null;
  /** 출시 이력 — Stats 화면 표시용. 최근 N개로 cap. 옛 데이터엔 없을 수 있음. */
  readonly history?: ReadonlyArray<SavedResult>;
  /** 인수합병 엔딩 표시 여부 — @deprecated endingsShown 으로 대체. 옛 데이터 호환용. */
  readonly endingShown?: boolean;
  /**
   * 본 엔딩 목록 — 'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq'. 옛 데이터 호환:
   * endingShown===true 이면 ['acquisition']으로 마이그레이트.
   */
  readonly endingsShown?: ReadonlyArray<'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq'>;
  /** 누적 달성 마일스톤 ID 목록. 옛 데이터엔 없으므로 옵셔널. */
  readonly milestones?: ReadonlyArray<MilestoneId>;
  /**
   * 전체 직원 상태 — 튜토리얼 3명 포함. skill 성장, rank 진급, track 선택 등 변경 보존.
   * 옛 데이터엔 없으므로(undefined) Boot가 TUTORIAL_EMPLOYEES + hiredEmployees로 폴백.
   */
  readonly employees?: ReadonlyArray<Employee>;
  /** R&D 영구 업그레이드 상태. 옛 데이터엔 없으므로 옵셔널. */
  readonly rnd?: RndState;
  /** 회사 시설 상태. 옛 데이터엔 없으므로 옵셔널. */
  readonly facilities?: FacilityState;
  /** 글로벌 시장 진출 상태. 옛 데이터엔 없으므로 옵셔널. */
  readonly markets?: MarketState;
  /** 자회사 인수 상태. 옛 데이터엔 없으므로 옵셔널. */
  readonly acquisitions?: AcquisitionState;
  /** 직전 프로젝트 슬롯 배정 — 새 프로젝트 시작 시 자동 복원용. 6 슬롯 (marketing/data 신규). */
  readonly lastAssignment?: Partial<Record<'planning' | 'graphics' | 'qa' | 'programming' | 'marketing' | 'data', string>>;
  /** 직전 프로젝트 support 배정 — 새 프로젝트 시작 시 자동 복원용. 6 슬롯. */
  readonly lastSupport?: Partial<Record<'planning' | 'graphics' | 'qa' | 'programming' | 'marketing' | 'data', string>>;
  /** 회사명. 미설정 시 DEFAULT_COMPANY_NAME 사용. */
  readonly companyName?: string;
  /** 수신 메일 목록 — cap 30. 옛 데이터엔 없으므로 옵셔널. */
  readonly mails?: ReadonlyArray<MailMessage>;
  /** 파산 상태 — 옵셔널 (옛 데이터 호환). */
  readonly bankruptcy?: BankruptcyState;
  /** 임원 압박 상태 — 옵셔널 (옛 데이터 호환). */
  readonly exec?: ExecState;
  /** 외부 경기 사이클 상태 — 옵셔널 (옛 데이터 호환). */
  readonly economy?: EconomyState;
  /** 경쟁사 출시 이력 — 옵셔널 (옛 데이터 호환). */
  readonly rivals?: RivalState;
}

/** 회사명 기본값. */
export const DEFAULT_COMPANY_NAME = '(주)판교개발';

/** 앱 설정(볼륨 등) — SaveData와 분리해 'game2.settings'에 저장. */
export interface AppSettings {
  bgmVolume: number; // 0~1
  sfxVolume: number; // 0~1
}

const SETTINGS_KEY = 'game2.settings';

/** 앱 설정 저장. */
export function saveSettings(s: AppSettings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

/** 앱 설정 로드. 없거나 파싱 실패 시 기본값 반환. */
export function loadSettings(): AppSettings {
  try {
    if (typeof localStorage === 'undefined') return { bgmVolume: 0.05, sfxVolume: 1.0 };
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { bgmVolume: 0.05, sfxVolume: 1.0 };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      bgmVolume: typeof parsed.bgmVolume === 'number' ? Math.max(0, Math.min(1, parsed.bgmVolume)) : 0.05,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : 1.0,
    };
  } catch {
    return { bgmVolume: 0.05, sfxVolume: 1.0 };
  }
}

/** history에 보관할 최대 개수. 너무 많아지면 storage 부담 + Stats UI도 길어짐. */
export const HISTORY_CAP = 50;

interface SaveDataV1 {
  readonly version: 1;
  readonly savedAt?: number;
  readonly gold?: number;
  readonly lastResult?: SavedResult | null;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

const VALID_NPC_IDS: ReadonlyArray<NpcId> = [
  'rival-ceo',
  'angel-investor',
  'exec-coach',
  'venture-capital',
  'gov-regulator',
  'tech-blogger',
];

/** 메일 목록 sanitize — cap 30, 필수 필드 타입 검증. choices는 함수라 직렬화 불가하므로 제거. */
function sanitizeMailsForSave(mails: ReadonlyArray<MailMessage>): ReadonlyArray<MailMessage> {
  const trimmed = mails.length > 30 ? [...mails].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 30) : mails;
  return trimmed.map((m) => ({
    id: m.id,
    fromNpcId: m.fromNpcId,
    subject: m.subject,
    body: m.body,
    receivedAt: m.receivedAt,
    read: m.read,
    // choices는 함수 포함이라 저장 불가 — 복원 시 재구성 불필요(상태는 read 여부만 보존).
  }));
}

/** 저장된 메일 목록 sanitize — 로드 시 호출. */
function sanitizeMails(raw: unknown): ReadonlyArray<MailMessage> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const validIds = new Set<string>(VALID_NPC_IDS);
  const result: MailMessage[] = [];
  for (const item of raw as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    if (
      typeof m['id'] !== 'string' ||
      typeof m['fromNpcId'] !== 'string' ||
      !validIds.has(m['fromNpcId']) ||
      typeof m['subject'] !== 'string' ||
      typeof m['body'] !== 'string' ||
      typeof m['receivedAt'] !== 'number' ||
      typeof m['read'] !== 'boolean'
    ) continue;
    result.push({
      id: m['id'],
      fromNpcId: m['fromNpcId'] as NpcId,
      subject: m['subject'],
      body: m['body'],
      receivedAt: m['receivedAt'],
      read: m['read'],
      // choices는 함수이므로 직렬화/역직렬화 불가 — 복원 없음.
    });
  }
  return result.length > 0 ? result : undefined;
}

export function saveData(input: {
  gold: number;
  productCount: number;
  officeLevel: OfficeLevel;
  hiredEmployees: ReadonlyArray<Employee>;
  lastResult: SavedResult | null;
  reputation: number;
  policy: CompanyPolicy;
  trend: TrendStatus | null;
  history?: ReadonlyArray<SavedResult>;
  endingsShown?: ReadonlyArray<'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq'>;
  employees?: ReadonlyArray<Employee>;
  rnd?: RndState;
  milestones?: ReadonlyArray<MilestoneId>;
  facilities?: FacilityState;
  markets?: MarketState;
  acquisitions?: AcquisitionState;
  lastAssignment?: Partial<Record<'planning' | 'graphics' | 'qa' | 'programming' | 'marketing' | 'data', string>>;
  lastSupport?: Partial<Record<'planning' | 'graphics' | 'qa' | 'programming' | 'marketing' | 'data', string>>;
  companyName?: string;
  mails?: ReadonlyArray<MailMessage>;
  bankruptcy?: BankruptcyState;
  exec?: ExecState;
  economy?: EconomyState;
  rivals?: RivalState;
}): SaveData | null {
  const storage = getStorage();
  if (!storage) return null;
  const full: SaveData = {
    version: 2,
    savedAt: Date.now(),
    gold: input.gold,
    productCount: input.productCount,
    officeLevel: input.officeLevel,
    hiredEmployees: input.hiredEmployees,
    lastResult: input.lastResult,
    reputation: input.reputation,
    policy: input.policy,
    trend: input.trend,
    history: input.history ?? [],
    endingsShown: input.endingsShown ?? [],
    ...(input.employees ? { employees: input.employees } : {}),
    ...(input.rnd ? { rnd: input.rnd } : {}),
    ...(input.milestones ? { milestones: input.milestones } : {}),
    ...(input.facilities ? { facilities: input.facilities } : {}),
    ...(input.markets ? { markets: input.markets } : {}),
    ...(input.acquisitions ? { acquisitions: input.acquisitions } : {}),
    ...(input.lastAssignment ? { lastAssignment: input.lastAssignment } : {}),
    ...(input.lastSupport ? { lastSupport: input.lastSupport } : {}),
    ...(input.companyName ? { companyName: input.companyName.slice(0, 20) } : {}),
    ...(input.mails ? { mails: sanitizeMailsForSave(input.mails) } : {}),
    ...(input.bankruptcy ? { bankruptcy: input.bankruptcy } : {}),
    ...(input.exec ? { exec: input.exec } : {}),
    ...(input.economy ? { economy: input.economy } : {}),
    ...(input.rivals ? { rivals: input.rivals } : {}),
  };
  try {
    storage.setItem(KEY, JSON.stringify(full));
    // Cloud sync — 로그인되어 있고 Supabase 활성화 시 비동기 push (debounce).
    // 동적 import로 순환 의존 회피 + cloud 모듈 미사용 시 트리쉐이크 가능.
    void import('./cloud/sync').then((m) => m.schedulePush(full)).catch(() => {});
    return full;
  } catch {
    return null;
  }
}

export function loadData(): SaveData | null {
  const storage = getStorage();
  if (!storage) return null;

  const primary = readAndParse(storage, KEY);
  if (primary !== null) return interpret(storage, primary, /* fromLegacy */ false);

  const legacy = readAndParse(storage, LEGACY_KEY_V1);
  if (legacy !== null) return interpret(storage, legacy, /* fromLegacy */ true);

  return null;
}

export function clearData(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(KEY);
    storage.removeItem(LEGACY_KEY_V1);
    // PRESTIGE_KEY는 의도적으로 삭제하지 않는다 — 프레스티지 회수는 영구 누적.
  } catch {
    /* noop */
  }
}

/**
 * 프레스티지 회수 로드. 0이면 아직 프레스티지 없음.
 * clearData()로 메인 세이브를 지워도 이 값은 보존된다.
 */
export function loadPrestigeCount(): number {
  try {
    const storage = getStorage();
    if (!storage) return 0;
    const raw = storage.getItem(PRESTIGE_KEY);
    return raw ? (parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

/**
 * 프레스티지 1회 증가 후 새 회수 반환.
 * 유니콘 엔딩에서 [프레스티지 시작] 확인 후 호출.
 */
export function incrementPrestige(): number {
  const next = loadPrestigeCount() + 1;
  try {
    const storage = getStorage();
    if (storage) storage.setItem(PRESTIGE_KEY, String(next));
  } catch {
    /* noop */
  }
  return next;
}

function readAndParse(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const VALID_RND_IDS: ReadonlyArray<RndId> = [
  'test-automation',
  'ci-cd',
  'design-system',
  'process-standard',
  'employer-branding',
  'finance-automation',
  'data-driven',
  'global-expansion',
  // Tier 2
  'ai-pair-programming',
  'auto-design-tools',
  'continuous-integration',
  'analytics-platform',
  'i18n-platform',
  'security-program',
  'cloud-migration',
  'remote-collaboration',
  // Tier 3
  'self-cloud-infra',
  'global-hr-network',
  'autonomous-deploy',
  'ai-pm-assistant',
  // Tier 4
  'quantum-deploy',
  'satellite-network',
  'neural-architecture',
  'company-os',
];

const VALID_MARKET_IDS: ReadonlyArray<MarketId> = MARKETS.map((m) => m.id);

const VALID_ACQUISITION_IDS: ReadonlyArray<AcquisitionId> = ACQUISITIONS.map((a) => a.id);

/** endingsShown sanitize — 옛 endingShown 필드 마이그레이션 포함. */
function sanitizeEndingsShown(
  raw: unknown,
  legacyEndingShown: boolean | undefined,
): ReadonlyArray<'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq'> {
  const valid: Array<'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq'> = [
    'acquisition',
    'ipo',
    'global-no1',
    'unicorn',
    'global-hq',
  ];
  if (Array.isArray(raw)) {
    return (raw as unknown[]).filter(
      (v): v is 'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq' => typeof v === 'string' && valid.includes(v as 'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq'),
    );
  }
  // 옛 데이터: endingShown===true 이면 acquisition을 한 번 본 것으로 마이그레이트.
  if (legacyEndingShown === true) return ['acquisition'];
  return [];
}

/** milestones — MILESTONES 화이트리스트로 필터. */
function sanitizeMilestones(raw: unknown): ReadonlyArray<MilestoneId> {
  const validIds = new Set<string>(MILESTONES.map((m) => m.id));
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(
    (v): v is MilestoneId => typeof v === 'string' && validIds.has(v),
  );
}

/** 시설 상태 sanitize — VALID_FACILITY_IDS 화이트리스트로 필터. */
function sanitizeFacilities(raw: unknown): FacilityState {
  if (!raw || typeof raw !== 'object') return EMPTY_FACILITIES;
  const obj = raw as { built?: unknown };
  if (!Array.isArray(obj.built)) return EMPTY_FACILITIES;
  const built = (obj.built as unknown[]).filter(
    (id): id is FacilityId =>
      typeof id === 'string' && (VALID_FACILITY_IDS as string[]).includes(id),
  );
  return { built };
}

/** 글로벌 시장 상태 sanitize — VALID_MARKET_IDS 화이트리스트로 필터. */
function sanitizeMarkets(raw: unknown): MarketState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as { entered?: unknown };
  if (!Array.isArray(obj.entered)) return undefined;
  const entered = (obj.entered as unknown[]).filter(
    (id): id is MarketId =>
      typeof id === 'string' && (VALID_MARKET_IDS as string[]).includes(id),
  );
  return { entered };
}

/** 직전 슬롯 배정 sanitize — 6 슬롯 string 값만 보존 (marketing/data 신규 포함). */
function sanitizeAssignment(raw: unknown): SaveData['lastAssignment'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: NonNullable<SaveData['lastAssignment']> = {};
  for (const slot of ['planning', 'graphics', 'qa', 'programming', 'marketing', 'data'] as const) {
    const v = r[slot];
    if (typeof v === 'string') out[slot] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** support 배정 sanitize — lastAssignment와 동일 구조 (6 슬롯). */
function sanitizeSupport(raw: unknown): SaveData['lastSupport'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: NonNullable<SaveData['lastSupport']> = {};
  for (const slot of ['planning', 'graphics', 'qa', 'programming', 'marketing', 'data'] as const) {
    const v = r[slot];
    if (typeof v === 'string') out[slot] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 자회사 인수 상태 sanitize — VALID_ACQUISITION_IDS 화이트리스트로 필터. */
function sanitizeAcquisitions(raw: unknown): AcquisitionState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as { completed?: unknown };
  if (!Array.isArray(obj.completed)) return undefined;
  const completed = (obj.completed as unknown[]).filter(
    (id): id is AcquisitionId =>
      typeof id === 'string' && (VALID_ACQUISITION_IDS as string[]).includes(id),
  );
  return { completed };
}

/** 장비 상태 sanitize — 슬롯별 tier 범위(1~5) 검증. */
function sanitizeEquipment(raw: unknown): EmployeeEquipment | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const eq = raw as Record<string, unknown>;
  const safe: Record<string, number> = {};
  for (const slot of ['desk', 'chair', 'monitor', 'laptop'] as EquipmentSlot[]) {
    const v = eq[slot];
    if (typeof v === 'number' && v >= 1 && v <= 5) safe[slot] = v;
  }
  if (Object.keys(safe).length === 0) return undefined;
  return safe as EmployeeEquipment;
}

/** 파산 상태 sanitize. */
function sanitizeBankruptcy(raw: unknown): BankruptcyState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj['lowGoldStreak'] !== 'number') return undefined;
  return { lowGoldStreak: Math.max(0, Math.floor(obj['lowGoldStreak'])) };
}

/** 임원 압박 상태 sanitize. */
function sanitizeExec(raw: unknown): ExecState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj['poorPerformanceStreak'] !== 'number') return undefined;
  return { poorPerformanceStreak: Math.max(0, Math.floor(obj['poorPerformanceStreak'])) };
}

function sanitizeRndProgress(raw: unknown): RndProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj['weeksRemaining'] !== 'number') return undefined;
  const inProgress = typeof obj['inProgress'] === 'string' && (VALID_RND_IDS as string[]).includes(obj['inProgress'])
    ? (obj['inProgress'] as RndId)
    : null;
  return { inProgress, weeksRemaining: Math.max(0, Math.floor(obj['weeksRemaining'])) };
}

function sanitizeRnd(raw: unknown): RndState {
  if (!raw || typeof raw !== 'object') return EMPTY_RND;
  const obj = raw as { purchased?: unknown; progress?: unknown; queue?: unknown };
  if (!Array.isArray(obj.purchased)) return EMPTY_RND;
  const purchased = (obj.purchased as unknown[]).filter(
    (id): id is RndId => typeof id === 'string' && (VALID_RND_IDS as string[]).includes(id),
  );
  const progress = sanitizeRndProgress(obj.progress);
  const reserved = new Set<RndId>(purchased);
  if (progress?.inProgress) reserved.add(progress.inProgress);
  const queue = Array.isArray(obj.queue)
    ? (obj.queue as unknown[]).filter((id): id is RndId => {
        if (typeof id !== 'string' || !(VALID_RND_IDS as string[]).includes(id)) return false;
        if (reserved.has(id as RndId)) return false;
        reserved.add(id as RndId);
        return true;
      })
    : [];
  return {
    purchased,
    ...(progress ? { progress } : {}),
    ...(queue.length > 0 ? { queue } : {}),
  };
}

/** 경쟁사 출시 이력 sanitize — rivalId 화이트리스트 + 필수 필드 검증. */
function sanitizeRivals(raw: unknown): RivalState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as { recentReleases?: unknown };
  if (!Array.isArray(obj.recentReleases)) return undefined;
  const validRivalIds: ReadonlyArray<RivalId> = RIVALS.map((r) => r.id);
  const validIds = new Set<string>(validRivalIds);
  const result: RivalRelease[] = [];
  for (const item of obj.recentReleases as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (
      typeof r['rivalId'] !== 'string' ||
      !validIds.has(r['rivalId']) ||
      typeof r['genre'] !== 'string' ||
      typeof r['theme'] !== 'string' ||
      typeof r['stars'] !== 'number' ||
      typeof r['revenue'] !== 'number' ||
      typeof r['quarter'] !== 'number'
    ) continue;
    result.push({
      rivalId: r['rivalId'] as RivalId,
      genre: r['genre'] as import('./domain/types').GenreId,
      theme: r['theme'] as import('./domain/types').ThemeId,
      stars: r['stars'],
      revenue: r['revenue'],
      quarter: r['quarter'],
    });
  }
  if (result.length === 0) return EMPTY_RIVALS;
  return { recentReleases: result };
}

/** 경기 사이클 상태 sanitize. */
function sanitizeEconomy(raw: unknown): EconomyState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj['index'] !== 'number' || typeof obj['cyclesElapsed'] !== 'number') return undefined;
  return {
    index: Math.max(0, Math.min(100, Math.round(obj['index']))),
    cyclesElapsed: Math.max(0, Math.floor(obj['cyclesElapsed'])),
  };
}

const VALID_STANCES: ReadonlyArray<Stance> = ['progressive', 'conservative'];
const VALID_RANKS: ReadonlyArray<Rank> = ['newbie', 'junior', 'senior', 'lead'];
const VALID_TRAITS: ReadonlyArray<Trait> = ['oldTimer', 'allTalk', 'remoteSlacker', 'perfectionist', 'crowd-pleaser', 'over-thinker'];
const VALID_TRACKS: ReadonlyArray<Track> = ['manager', 'ic'];

function sanitizeEmployee(raw: unknown): Employee | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Partial<Employee> & {
    job?: string;
    stance?: string;
    rank?: string;
    trait?: string;
    track?: string;
    lowMoraleStreak?: number;
    growthRate?: number;
    equipment?: unknown;
  };
  if (typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.job !== 'string') {
    return null;
  }
  // PIVOT-1 마이그레이션: 옛 'sound' 직군은 'qa'로.
  const rawJob: string = e.job;
  const migratedJob = (rawJob === 'sound' ? 'qa' : rawJob) as Job;

  // PIVOT-3 마이그레이션: stance/rank/shippedProjects 결측 시 default.
  const stance: Stance = VALID_STANCES.includes(e.stance as Stance)
    ? (e.stance as Stance)
    : 'conservative';
  const rank: Rank = VALID_RANKS.includes(e.rank as Rank) ? (e.rank as Rank) : 'junior';
  const trait: Trait | undefined = VALID_TRAITS.includes(e.trait as Trait)
    ? (e.trait as Trait)
    : undefined;
  const track: Track | undefined = VALID_TRACKS.includes(e.track as Track)
    ? (e.track as Track)
    : undefined;

  const equipment = sanitizeEquipment(e.equipment);
  const result: Employee = {
    id: e.id,
    name: e.name,
    job: migratedJob,
    skill: typeof e.skill === 'number' ? e.skill : 1,
    morale: typeof e.morale === 'number' ? e.morale : CONDITION.defaultMorale,
    stamina: typeof e.stamina === 'number' ? e.stamina : CONDITION.defaultStamina,
    stance,
    rank,
    shippedProjects: typeof e.shippedProjects === 'number' ? e.shippedProjects : 0,
    ...(trait ? { trait } : {}),
    ...(track ? { track } : {}),
    ...(typeof e.lowMoraleStreak === 'number' ? { lowMoraleStreak: e.lowMoraleStreak } : {}),
    ...(typeof e.growthRate === 'number' ? { growthRate: e.growthRate } : {}),
    ...(equipment ? { equipment } : {}),
  };
  return result;
}

function sanitizeHired(raw: unknown): ReadonlyArray<Employee> {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeEmployee).filter((e): e is Employee => e !== null);
}

function interpret(storage: Storage, parsed: unknown, fromLegacy: boolean): SaveData | null {
  if (!parsed || typeof parsed !== 'object') return backupAndNull(storage, parsed);
  const obj = parsed as Partial<SaveData> & Partial<SaveDataV1>;

  if (obj.version === 2) {
    if (typeof obj.gold !== 'number') return backupAndNull(storage, parsed);
    // officeLevel 검증 — 잘못된 값이면 1로 fallback.
    const rawLevel = obj.officeLevel;
    const safeOfficeLevel: OfficeLevel =
      rawLevel === 1 || rawLevel === 2 || rawLevel === 3 || rawLevel === 4 || rawLevel === 5 || rawLevel === 6
        ? rawLevel
        : 1;
    // endingsShown 마이그레이션 — 옛 endingShown===true 이면 ['acquisition']으로 승격.
    const sanitizedEndingsShown = sanitizeEndingsShown(obj.endingsShown, obj.endingShown);
    // milestones 화이트리스트 필터.
    const sanitizedMilestones = sanitizeMilestones(obj.milestones);
    // hiredEmployees / employees에 morale/stamina가 누락된 옛 v2 데이터를 보강.
    const sanitizedMarkets = sanitizeMarkets(obj.markets);
    const sanitizedAcquisitions = sanitizeAcquisitions(obj.acquisitions);
    const sanitized: SaveData = {
      ...(obj as SaveData),
      officeLevel: safeOfficeLevel,
      hiredEmployees: sanitizeHired(obj.hiredEmployees),
      ...(obj.employees ? { employees: sanitizeHired(obj.employees) } : {}),
      rnd: sanitizeRnd(obj.rnd),
      facilities: sanitizeFacilities(obj.facilities),
      endingsShown: sanitizedEndingsShown,
      milestones: sanitizedMilestones,
      ...(sanitizedMarkets ? { markets: sanitizedMarkets } : {}),
      ...(sanitizedAcquisitions ? { acquisitions: sanitizedAcquisitions } : {}),
      ...(obj.lastAssignment ? { lastAssignment: sanitizeAssignment(obj.lastAssignment) } : {}),
      ...(obj.lastSupport ? { lastSupport: sanitizeSupport(obj.lastSupport) } : {}),
      ...(obj.mails ? { mails: sanitizeMails(obj.mails) } : {}),
      ...(obj.bankruptcy ? { bankruptcy: sanitizeBankruptcy(obj.bankruptcy) } : {}),
      ...(obj.exec ? { exec: sanitizeExec(obj.exec) } : {}),
      ...(obj.economy ? { economy: sanitizeEconomy(obj.economy) } : {}),
      ...(obj.rivals ? { rivals: sanitizeRivals(obj.rivals) } : {}),
    };
    if (fromLegacy) {
      saveDataDirect(storage, sanitized);
      removeKey(storage, LEGACY_KEY_V1);
    }
    return sanitized;
  }

  if (obj.version === 1) {
    const upgraded: SaveData = {
      version: 2,
      savedAt: typeof obj.savedAt === 'number' ? obj.savedAt : Date.now(),
      gold: typeof obj.gold === 'number' ? obj.gold : 0,
      productCount: 0,
      officeLevel: 1,
      hiredEmployees: [],
      lastResult: obj.lastResult ?? null,
    };
    // 새 키로 즉시 옮기고 legacy 정리해 동일 데이터의 두 키 공존을 막는다.
    saveDataDirect(storage, upgraded);
    if (fromLegacy) removeKey(storage, LEGACY_KEY_V1);
    return upgraded;
  }

  return backupAndNull(storage, parsed);
}

function saveDataDirect(storage: Storage, data: SaveData): void {
  try {
    storage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* noop — 사용자 흐름은 막지 않는다 */
  }
}

function removeKey(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* noop */
  }
}

function backupAndNull(storage: Storage, raw: unknown): null {
  // 데이터 손실 방지 — 인식 못한 형식은 별도 키로 보존.
  try {
    storage.setItem(UNKNOWN_BACKUP_KEY, JSON.stringify({ at: Date.now(), raw }));
  } catch {
    /* noop */
  }
  return null;
}
