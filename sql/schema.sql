-- Apply Ready — Database Schema
-- Run this in the Supabase SQL Editor for your project.

-- ── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            TEXT,
  email                TEXT,
  avatar_url           TEXT,
  situation            TEXT CHECK (situation IN (
    'entry-level', 'lateral', 'stretch', 'career-switch',
    'returning', 'relocating', 'employed-exploring',
    'laid-off', 'contract-perm', 'semi-retired', 'other'
  )),
  situation_other      TEXT,
  resume_style         TEXT DEFAULT 'classic' CHECK (resume_style IN (
    'classic', 'modern', 'ats-safe', 'editorial', 'executive'
  )),
  target_roles         JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_regions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  seniority_target     TEXT,
  remote_preference    TEXT CHECK (remote_preference IN ('remote', 'hybrid', 'onsite', 'flexible')),
  compensation_floor   NUMERIC,
  compensation_currency TEXT DEFAULT 'USD',
  larger_build_note    TEXT,
  last_seen_jobs_at    TIMESTAMPTZ,
  onboarding_step      INTEGER NOT NULL DEFAULT 0,
  onboarding_complete  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Auto-create profile on signup ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Updated-at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Resumes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resumes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  storage_path TEXT,
  raw_text     TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Jobs (shared listing cache) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id          TEXT UNIQUE NOT NULL,
  source               TEXT NOT NULL,
  title                TEXT NOT NULL,
  company              TEXT NOT NULL,
  location             TEXT,
  region               TEXT,
  remote_type          TEXT CHECK (remote_type IN ('remote', 'hybrid', 'onsite', 'unknown')),
  description          TEXT NOT NULL,
  compensation_min     NUMERIC,
  compensation_max     NUMERIC,
  compensation_currency TEXT DEFAULT 'USD',
  url                  TEXT,
  posted_at            TIMESTAMPTZ,
  cached_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS jobs_external_id_idx ON jobs (external_id);
CREATE INDEX IF NOT EXISTS jobs_expires_at_idx  ON jobs (expires_at);

-- ── User ↔ Job interactions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_jobs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id                    UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status                    TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'interested', 'ignored', 'applied'
  )),
  fit_score                 INTEGER CHECK (fit_score BETWEEN 0 AND 100),
  fit_score_report          JSONB,
  score_improvement_answers JSONB DEFAULT '[]'::jsonb,
  tailored_resume_text      TEXT,
  tailored_resume_style     TEXT,
  cover_letter_text         TEXT,
  interview_prep            JSONB,
  post_interview_debrief    JSONB,
  journey_status            TEXT CHECK (journey_status IN (
    'applied', 'phone-screen', 'first-interview', 'subsequent-interview',
    'final-round', 'offer', 'rejected', 'ghosted', 'accepted', 'declined', 'withdrawn'
  )),
  journey_notes             TEXT,
  applied_at                TIMESTAMPTZ,
  first_seen_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS user_jobs_user_id_idx    ON user_jobs (user_id);
CREATE INDEX IF NOT EXISTS user_jobs_status_idx     ON user_jobs (user_id, status);

CREATE TRIGGER user_jobs_updated_at BEFORE UPDATE ON user_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Alias for the trigger function name mismatch
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── User-added jobs (BYO metadata) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_added_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id      UUID REFERENCES jobs(id) ON DELETE SET NULL,
  source_url  TEXT,
  source_type TEXT CHECK (source_type IN ('url', 'text', 'screenshot', 'pdf')),
  raw_input   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row-Level Security ──────────────────────────────────────────────────────
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_added_jobs ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- resumes: own rows only
CREATE POLICY "resumes_select" ON resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "resumes_insert" ON resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resumes_update" ON resumes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "resumes_delete" ON resumes FOR DELETE USING (auth.uid() = user_id);

-- jobs: all authenticated users can read; only service role writes
CREATE POLICY "jobs_read" ON jobs FOR SELECT TO authenticated USING (true);

-- user_jobs: own rows only
CREATE POLICY "user_jobs_select" ON user_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_jobs_insert" ON user_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_jobs_update" ON user_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_jobs_delete" ON user_jobs FOR DELETE USING (auth.uid() = user_id);

-- user_added_jobs: own rows only
CREATE POLICY "user_added_select" ON user_added_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_added_insert" ON user_added_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Storage bucket (run in Supabase dashboard or Storage UI) ────────────────
-- INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
-- CREATE POLICY "resumes_upload" ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "resumes_read" ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
