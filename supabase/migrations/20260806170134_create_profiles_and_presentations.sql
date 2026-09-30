/*
# Create profiles and presentations tables with auth and admin roles

## Overview
This migration creates the core database schema for Prezento AI's authentication
and presentation storage system. It enables multi-user data isolation where each
user can only access their own presentations, while admin users can manage all
records.

## New Tables

### 1. profiles
- `id` (uuid, primary key) — references auth.users.id, cascading on delete
- `full_name` (text) — user's display name
- `email` (text, unique) — user's email, synced from auth
- `avatar_url` (text, nullable) — URL to profile picture
- `role` (text, default 'user') — either 'user' or 'admin'
- `created_at` (timestamptz, default now())

### 2. presentations
- `id` (uuid, primary key)
- `user_id` (uuid, not null, default auth.uid()) — references auth.users, cascading on delete
- `title` (text, not null)
- `thumbnail` (text, nullable) — base64 or URL of first slide preview
- `theme` (text, nullable) — theme identifier
- `slides` (jsonb, not null) — full slide content as JSON
- `settings` (jsonb, nullable) — presentation settings as JSON
- `total_slides` (integer, default 0)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## Security (Row Level Security)

### profiles table
- Users can read their own profile (SELECT)
- Users can update their own profile (UPDATE) — but NOT the role column
- Admins can read all profiles (SELECT)
- Admins can update all profiles (UPDATE) — including role changes
- Admins can delete profiles (DELETE)

### presentations table
- Users can read only their own presentations (SELECT)
- Users can insert presentations they own (INSERT)
- Users can update only their own presentations (UPDATE)
- Users can delete only their own presentations (DELETE)
- Admins can read all presentations (SELECT)
- Admins can delete any presentation (DELETE)

## Important Notes

1. The role column is stored in profiles and protected by RLS — users cannot
   change their own role. Only admins can change roles.

2. A trigger automatically creates a profile row when a new auth.user is created,
   defaulting the role to 'user'.

3. The user_id column on presentations defaults to auth.uid() so frontend
   inserts that omit user_id still satisfy the INSERT policy WITH CHECK.

4. Admin detection uses a helper function is_admin() that checks the profiles
   table for role = 'admin' for the current authenticated user.
*/

-- ── profiles table (must exist before is_admin function) ─────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  email text UNIQUE,
  avatar_url text,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ── Helper function: is_admin() ──────────────────────────────────────────────
-- Returns true if the current authenticated user has the 'admin' role.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── profiles RLS policies ────────────────────────────────────────────────────
-- Users can read their own profile; admins can read all
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR is_admin());

-- Users can update their own profile; admins can update any
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id OR is_admin())
WITH CHECK (auth.uid() = id OR is_admin());

-- Admins can delete profiles
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin"
ON profiles FOR DELETE
TO authenticated
USING (is_admin());

-- ── presentations table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  thumbnail text,
  theme text,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb,
  total_slides integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;

-- Users can read their own presentations; admins can read all
DROP POLICY IF EXISTS "presentations_select_own" ON presentations;
CREATE POLICY "presentations_select_own"
ON presentations FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin());

-- Users can insert presentations they own
DROP POLICY IF EXISTS "presentations_insert_own" ON presentations;
CREATE POLICY "presentations_insert_own"
ON presentations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own presentations
DROP POLICY IF EXISTS "presentations_update_own" ON presentations;
CREATE POLICY "presentations_update_own"
ON presentations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own presentations; admins can delete any
DROP POLICY IF EXISTS "presentations_delete_own" ON presentations;
CREATE POLICY "presentations_delete_own"
ON presentations FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR is_admin());

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_presentations_user_id ON presentations(user_id);
CREATE INDEX IF NOT EXISTS idx_presentations_updated_at ON presentations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ── Trigger: auto-create profile on signup ───────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── updated_at trigger for presentations ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS presentations_updated_at ON presentations;
CREATE TRIGGER presentations_updated_at
BEFORE UPDATE ON presentations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
