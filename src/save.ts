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
import type { Employee } from './domain/types';

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

function interpret(storage: Storage, parsed: unknown, fromLegacy: boolean): SaveData | null {
  if (!parsed || typeof parsed !== 'object') return backupAndNull(storage, parsed);
  const obj = parsed as Partial<SaveData> & Partial<SaveDataV1>;

  if (obj.version === 2) {
    if (typeof obj.gold !== 'number') return backupAndNull(storage, parsed);
    if (fromLegacy) {
      // v2 데이터가 어쩌다 LEGACY_KEY에 있는 경우 — 정상 키로 옮기고 legacy 정리
      saveDataDirect(storage, obj as SaveData);
      removeKey(storage, LEGACY_KEY_V1);
    }
    return obj as SaveData;
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
