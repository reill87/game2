/**
 * 클라우드 동기화 — Supabase 이메일+비밀번호 인증 + SaveData JSON push/pull.
 *
 * 동작:
 *  - Supabase 환경변수 미설정 / 미로그인 → 모든 함수 no-op (게임은 로컬만으로 동작).
 *  - SaveData는 game2_saves.data (JSONB)에 통째로 저장.
 *  - 비정규화 컬럼(total_revenue/product_count/prestige_count/office_level/best_revenue)은
 *    리더보드 인덱스용. push 시 SaveData에서 계산해 함께 upsert.
 *  - 동시 push 가드: savePromise pending이면 await.
 *
 * 사용자 흐름:
 *  1) 비로그인: 게임 그대로 로컬 저장만.
 *  2) Settings에서 가입/로그인 → 닉네임 등록.
 *  3) 이후 saveData() 시 자동 cloud push (debounce는 호출자 책임).
 *  4) 다른 기기에서 로그인 → Boot에서 pull 비교 후 newer면 사용 모달.
 */
import { supabase, isSupabaseEnabled } from './supabase';
import { type SaveData } from '@/save';
import { loadPrestigeCount } from '@/save';

let cachedUserId: string | null = null;
let savePromise: Promise<void> | null = null;

export type AuthResult = { ok: boolean; reason?: string };

export type LeaderboardRow = {
  user_id: string;
  nickname: string;
  total_revenue: number;
  product_count: number;
  prestige_count: number;
  office_level: number;
  best_revenue: number;
  updated_at: string;
};

export type LeaderboardSort =
  | 'total_revenue'
  | 'product_count'
  | 'prestige_count'
  | 'office_level'
  | 'best_revenue';

// ──────────────────────────────────────────────────────────────────
// 세션
// ──────────────────────────────────────────────────────────────────

export async function getSessionUserId(): Promise<string | null> {
  if (!isSupabaseEnabled() || !supabase) return null;
  if (cachedUserId) return cachedUserId;
  const { data } = await supabase.auth.getSession();
  cachedUserId = data.session?.user.id ?? null;
  return cachedUserId;
}

export function isLoggedIn(): boolean {
  return cachedUserId !== null;
}

export function clearCachedUserId(): void {
  cachedUserId = null;
}

// ──────────────────────────────────────────────────────────────────
// 인증
// ──────────────────────────────────────────────────────────────────

async function ensureUserProfile(userId: string, nicknameHint?: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, reason: 'Supabase 환경변수(.env) 미설정' };

  const { data: existing, error: selectError } = await supabase
    .from('game2_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (selectError) {
    return { ok: false, reason: `프로필 확인 실패: ${selectError.message}` };
  }
  if (existing) return { ok: true };

  const nickname = (nicknameHint?.trim().slice(0, 20) || '익명');
  const { error: insertError } = await supabase
    .from('game2_users')
    .insert({ id: userId, nickname });
  if (insertError) {
    return { ok: false, reason: `프로필 생성 실패: ${insertError.message}` };
  }
  return { ok: true };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  nickname: string,
): Promise<AuthResult> {
  if (!isSupabaseEnabled() || !supabase) {
    return { ok: false, reason: 'Supabase 환경변수(.env) 미설정' };
  }
  const trimmedNick = nickname.trim().slice(0, 20);
  if (!trimmedNick) return { ok: false, reason: '닉네임을 입력해주세요.' };
  if (password.length < 6) return { ok: false, reason: '비밀번호는 최소 6자입니다.' };

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const userId = data.user?.id;
  if (!userId) {
    return {
      ok: false,
      reason: '가입 후 사용자 ID를 받지 못했습니다. 이메일 인증이 필요한 환경이라면 메일 확인 후 다시 시도하세요.',
    };
  }
  cachedUserId = userId;

  const { error: nickError } = await supabase
    .from('game2_users')
    .upsert({ id: userId, nickname: trimmedNick }, { onConflict: 'id' });
  if (nickError) {
    return { ok: true, reason: `가입은 성공했으나 닉네임 저장 실패: ${nickError.message}` };
  }
  return { ok: true };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!isSupabaseEnabled() || !supabase) {
    return { ok: false, reason: 'Supabase 환경변수(.env) 미설정' };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  cachedUserId = data.user?.id ?? null;
  if (cachedUserId) {
    const emailPrefix = data.user?.email?.split('@')[0];
    const profile = await ensureUserProfile(cachedUserId, emailPrefix);
    if (!profile.ok) return profile;
  }
  return { ok: true };
}

export async function signOut(): Promise<AuthResult> {
  if (!isSupabaseEnabled() || !supabase) return { ok: true };
  const { error } = await supabase.auth.signOut();
  cachedUserId = null;
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────
// 닉네임
// ──────────────────────────────────────────────────────────────────

export async function fetchOwnNickname(): Promise<string | null> {
  if (!isSupabaseEnabled() || !supabase) return null;
  const userId = await getSessionUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('game2_users')
    .select('nickname')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data?.nickname ?? null;
}

export async function setNickname(nickname: string): Promise<AuthResult> {
  if (!isSupabaseEnabled() || !supabase) {
    return { ok: false, reason: 'Supabase 환경변수(.env) 미설정' };
  }
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, reason: '로그인이 필요합니다.' };

  const trimmed = nickname.trim().slice(0, 20);
  if (!trimmed) return { ok: false, reason: '닉네임을 입력해주세요.' };

  const { error } = await supabase
    .from('game2_users')
    .upsert({ id: userId, nickname: trimmed }, { onConflict: 'id' });
  if (error) return { ok: false, reason: `DB 오류: ${error.message}` };
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────
// 세이브 push/pull
// ──────────────────────────────────────────────────────────────────

/** SaveData에서 리더보드용 비정규화 필드 계산. */
function deriveLeaderboardCols(save: SaveData): {
  total_revenue: number;
  product_count: number;
  prestige_count: number;
  office_level: number;
  best_revenue: number;
} {
  const history = save.history ?? [];
  const total = history.reduce((s, r) => s + r.revenue, 0);
  const best = history.reduce((m, r) => Math.max(m, r.revenue), 0);
  return {
    total_revenue: total,
    product_count: save.productCount,
    prestige_count: loadPrestigeCount(),
    office_level: save.officeLevel,
    best_revenue: best,
  };
}

export async function loadCloudSave(): Promise<{ data: SaveData; updatedAt: string } | null> {
  if (!isSupabaseEnabled() || !supabase) return null;
  const userId = await getSessionUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('game2_saves')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return { data: data.data as SaveData, updatedAt: data.updated_at as string };
}

export async function pushCloudSave(save: SaveData): Promise<boolean> {
  if (!isSupabaseEnabled() || !supabase) return false;
  const userId = await getSessionUserId();
  if (!userId) return false;
  const profile = await ensureUserProfile(userId);
  if (!profile.ok) {
    // eslint-disable-next-line no-console
    console.warn('[cloud] ensure profile failed', profile.reason);
    return false;
  }

  // 동시 push 직렬화.
  if (savePromise) await savePromise;

  let ok = true;
  savePromise = (async () => {
    if (!supabase) return;
    try {
      const cols = deriveLeaderboardCols(save);
      const payload = { user_id: userId, data: save, ...cols };
      const { error } = await supabase
        .from('game2_saves')
        .upsert(payload, { onConflict: 'user_id' });
      if (!error) return;
      ok = false;
      // eslint-disable-next-line no-console
      console.warn('[cloud] push save failed', error.message);
    } catch (error) {
      ok = false;
      // eslint-disable-next-line no-console
      console.warn('[cloud] push save failed', error);
    }
  })();

  try {
    await savePromise;
  } finally {
    savePromise = null;
  }
  return ok;
}

// ──────────────────────────────────────────────────────────────────
// 리더보드
// ──────────────────────────────────────────────────────────────────

export async function fetchLeaderboard(
  sort: LeaderboardSort = 'total_revenue',
  limit = 30,
): Promise<LeaderboardRow[]> {
  if (!isSupabaseEnabled() || !supabase) return [];

  const { data, error } = await supabase
    .from('game2_leaderboard')
    .select('*')
    .order(sort, { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as LeaderboardRow[];
}

// ──────────────────────────────────────────────────────────────────
// 동기화 헬퍼 — push debouncer
// ──────────────────────────────────────────────────────────────────

let debouncedPushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 짧은 시간 안에 여러 번 saveData 호출돼도 cloud push는 마지막 1번만.
 * @param delayMs 기본 2000ms — 사용자가 연속 액션 마치면 푸시.
 */
export function schedulePush(save: SaveData, delayMs = 2000): void {
  if (!isSupabaseEnabled()) return;
  if (debouncedPushTimer) clearTimeout(debouncedPushTimer);
  debouncedPushTimer = setTimeout(() => {
    debouncedPushTimer = null;
    void pushCloudSave(save);
  }, delayMs);
}

/** 즉시 push (Settings 'Sync now' 같은 명시적 액션). */
export async function pushNow(save: SaveData): Promise<boolean> {
  if (debouncedPushTimer) {
    clearTimeout(debouncedPushTimer);
    debouncedPushTimer = null;
  }
  return pushCloudSave(save);
}
