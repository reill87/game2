-- =============================================================
-- 판교개발 시뮬 (game2) — Supabase 스키마
-- 같은 stockontext DB에 game2_ prefix 테이블만 추가
-- 다른 게임(game)의 game_users / game_saves와 충돌 없음
-- =============================================================

-- 1) 사용자 테이블 (Supabase auth.users와 1:1) — 게임별 닉네임 분리.
CREATE TABLE IF NOT EXISTS public.game2_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game2_users_nickname ON public.game2_users(nickname);

-- 2) 클라우드 세이브 (1 user : 1 row, SaveData 통째로 JSON)
-- 비정규화 컬럼: 리더보드 정렬·필터 인덱스용.
CREATE TABLE IF NOT EXISTS public.game2_saves (
  user_id UUID PRIMARY KEY REFERENCES public.game2_users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  -- 리더보드용 비정규화
  total_revenue BIGINT NOT NULL DEFAULT 0,
  product_count INTEGER NOT NULL DEFAULT 0,
  prestige_count INTEGER NOT NULL DEFAULT 0,
  office_level SMALLINT NOT NULL DEFAULT 1,
  best_revenue INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game2_saves_total_revenue ON public.game2_saves(total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_game2_saves_product_count ON public.game2_saves(product_count DESC);
CREATE INDEX IF NOT EXISTS idx_game2_saves_prestige ON public.game2_saves(prestige_count DESC);
CREATE INDEX IF NOT EXISTS idx_game2_saves_office_level ON public.game2_saves(office_level DESC);
CREATE INDEX IF NOT EXISTS idx_game2_saves_best_revenue ON public.game2_saves(best_revenue DESC);

-- 3) 리더보드 뷰 (닉네임 join)
CREATE OR REPLACE VIEW public.game2_leaderboard AS
SELECT
  u.id AS user_id,
  u.nickname,
  s.total_revenue,
  s.product_count,
  s.prestige_count,
  s.office_level,
  s.best_revenue,
  s.updated_at
FROM public.game2_users u
JOIN public.game2_saves s ON s.user_id = u.id;

-- =============================================================
-- RLS (Row-Level Security)
-- =============================================================
ALTER TABLE public.game2_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game2_saves ENABLE ROW LEVEL SECURITY;

-- game2_users: 모두 읽기 가능 (리더보드 닉네임 표시).
DROP POLICY IF EXISTS "Anyone can read game2 users (for leaderboard)" ON public.game2_users;
CREATE POLICY "Anyone can read game2 users (for leaderboard)"
  ON public.game2_users FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users insert their own game2 row" ON public.game2_users;
CREATE POLICY "Users insert their own game2 row"
  ON public.game2_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update their own game2 row" ON public.game2_users;
CREATE POLICY "Users update their own game2 row"
  ON public.game2_users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- game2_saves: 본인만 읽기/쓰기. 리더보드는 view 우회.
DROP POLICY IF EXISTS "Users read own game2 save" ON public.game2_saves;
CREATE POLICY "Users read own game2 save"
  ON public.game2_saves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own game2 save" ON public.game2_saves;
CREATE POLICY "Users insert own game2 save"
  ON public.game2_saves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own game2 save" ON public.game2_saves;
CREATE POLICY "Users update own game2 save"
  ON public.game2_saves FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.game2_leaderboard TO anon, authenticated;

-- =============================================================
-- updated_at 자동 갱신 트리거 — game DB의 set_updated_at() 함수 재사용.
-- (game/docs/supabase-schema.sql에서 이미 정의됨. 없다면 아래 주석 풀어 생성)
-- =============================================================
-- CREATE OR REPLACE FUNCTION public.set_updated_at()
-- RETURNS TRIGGER LANGUAGE plpgsql AS $function$
-- BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
-- $function$;

DROP TRIGGER IF EXISTS trg_game2_users_updated_at ON public.game2_users;
CREATE TRIGGER trg_game2_users_updated_at
  BEFORE UPDATE ON public.game2_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_game2_saves_updated_at ON public.game2_saves;
CREATE TRIGGER trg_game2_saves_updated_at
  BEFORE UPDATE ON public.game2_saves
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
