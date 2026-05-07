/**
 * 단일 슬롯 localStorage 저장. v2 = productCount + officeLevel + 추가 채용 직원 포함.
 * 실패(스토리지 비활성·할당 초과·JSON 깨짐)는 모두 null로 흡수해 게임 흐름을 막지 않는다.
 *
 * 마이그레이션 정책:
 *  - v1 데이터(slice 3 호환)를 그대로 받아 productCount=0, officeLevel=1, hiredEmployees=[]로 보강한다.
 *  - 미인식 버전은 null 반환 (사용자에게는 "저장 없음"으로 보임).
 */
import type { Employee } from './domain/types';

const KEY = 'game2.save.v1';

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
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const obj = parsed as Partial<SaveData> & Partial<SaveDataV1>;

    if (obj.version === 2) {
      if (typeof obj.gold !== 'number') return null;
      return obj as SaveData;
    }

    if (obj.version === 1) {
      // v1 → v2 보강
      return {
        version: 2,
        savedAt: typeof obj.savedAt === 'number' ? obj.savedAt : Date.now(),
        gold: typeof obj.gold === 'number' ? obj.gold : 0,
        productCount: 0,
        officeLevel: 1,
        hiredEmployees: [],
        lastResult: obj.lastResult ?? null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function clearData(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
