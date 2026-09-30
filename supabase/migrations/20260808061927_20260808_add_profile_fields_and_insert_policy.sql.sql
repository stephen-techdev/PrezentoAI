/*
# Add username, gender, updated_at columns to profiles + INSERT policy

## Changes
1. Adds username, gender, updated_at columns to profiles (idempotent)
2. Adds unique constraint on username
3. Adds INSERT policy so users can create their own profile
4. Replaces handle_new_user trigger to capture new fields
5. Adds updated_at trigger on profiles
*/

-- ── Add new columns (idempotent) ─────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── Unique constraint on username ────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_unique'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
  END IF;
END $$;

-- ── INSERT policy for profiles ───────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ── Replace handle_new_user trigger to capture username, gender, avatar ──────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url, username, gender)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', NULL),
    COALESCE(NEW.raw_user_meta_data->>'gender', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    username = COALESCE(EXCLUDED.username, profiles.username),
    gender = COALESCE(EXCLUDED.gender, profiles.gender),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- ── updated_at trigger for profiles ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_profile_updated_at();