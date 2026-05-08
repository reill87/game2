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
import type {
  CompanyPolicy,
  Employee,
  Job,
  Rank,
  Stance,
  Trait,
  TrendStatus,
} from './domain/types';

const KEY = 'game2.save';
const LEGACY_KEY_V1 = 'game2.save.v1';
const UNKNOWN_BACKUP_KEY = 'game2.save.unknown';

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
}

export interface SaveData {
  readonly version: 2;
  readonly savedAt: number;
  readonly gold: number;
  readonly productCount: number;
  readonly officeLevel: 1 | 2;
  readonly hiredEmployees: ReadonlyArray<Employee>;
  readonly lastResult: SavedResult | null;
  /** 회사 누적 명성 — PIVOT-4. 옛 v2 데이터엔 없을 수 있어 옵셔널 취급. */
  readonly reputation?: number;
  /** 회사 정책 — PIVOT-5. 옛 데이터엔 없으므로 옵셔널, default로 보강. */
  readonly policy?: CompanyPolicy;
  /** 시장 트렌드 — PIVOT-6. null/undefined면 Boot에서 새 트렌드 pick. */
  readonly trend?: TrendStatus | null;
}

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

export function saveData(input: {
  gold: number;
  productCount: number;
  officeLevel: 1 | 2;
  hiredEmployees: ReadonlyArray<Employee>;
  lastResult: SavedResult | null;
  reputation: number;
  policy: CompanyPolicy;
  trend: TrendStatus | null;
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
  };
  try {
    storage.setItem(KEY, JSON.stringify(full));
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
  } catch {
    /* noop */
  }
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

const VALID_STANCES: ReadonlyArray<Stance> = ['progressive', 'conservative'];
const VALID_RANKS: ReadonlyArray<Rank> = ['newbie', 'junior', 'senior', 'lead'];
const VALID_TRAITS: ReadonlyArray<Trait> = ['oldTimer', 'allTalk', 'remoteSlacker'];

function sanitizeEmployee(raw: unknown): Employee | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Partial<Employee> & { job?: string; stance?: string; rank?: string; trait?: string };
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
    // hiredEmployees에 morale/stamina가 누락된 옛 v2 데이터를 보강.
    const sanitized: SaveData = {
      ...(obj as SaveData),
      hiredEmployees: sanitizeHired(obj.hiredEmployees),
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
