/**
 * 단일 슬롯 localStorage 저장. v1 슬라이스 3 — gold 이월 + 마지막 결과 캐시만.
 * 실패(스토리지 비활성·할당 초과·JSON 깨짐)는 모두 null로 흡수해 게임 흐름을 막지 않는다.
 */

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
  readonly version: 1;
  readonly savedAt: number;
  readonly gold: number;
  readonly lastResult: SavedResult | null;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function saveData(input: { gold: number; lastResult: SavedResult | null }): SaveData | null {
  const storage = getStorage();
  if (!storage) return null;
  const full: SaveData = {
    version: 1,
    savedAt: Date.now(),
    gold: input.gold,
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
    const obj = parsed as Partial<SaveData>;
    if (obj.version !== 1) return null;
    if (typeof obj.gold !== 'number') return null;
    return obj as SaveData;
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
