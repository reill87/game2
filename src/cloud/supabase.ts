/**
 * Supabase 클라이언트 — VITE_SUPABASE_URL/KEY 환경변수로 활성화.
 * 미설정 시 supabase=null. 호출부는 isSupabaseEnabled()로 분기.
 *
 * Vercel 배포 시 환경변수에 동일 키 설정 필요.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

export function isSupabaseEnabled(): boolean {
  return supabase !== null;
}
