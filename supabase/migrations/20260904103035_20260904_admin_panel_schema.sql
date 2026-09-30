/*
# Admin Panel Schema Extension

## Overview
Extends the existing Prezento database with tables and columns needed for
the administrator panel: user activity tracking, visitor analytics, activity
logs, and admin audit logs. Also recreates the is_admin() helper function
that was defined in the initial migration but not present in the live DB.

## Changes to existing tables

### profiles (add columns)
- `last_login` (timestamptz, nullable) — timestamp of the user's most recent login
- `last_activity` (timestamptz, nullable) — timestamp of the user's most recent activity
- `is_disabled` (boolean, default false) — when true, the account is disabled

## New Functions
- `is_admin()` — returns true if the current authenticated user has role='admin' in profiles

## New Tables

### visitor_events
- `id` (uuid, primary key)
- `visitor_id` (text, not null) — anonymous identifier (stored in localStorage, not PII)
- `path` (text, nullable) — the page path visited
- `created_at` (timestamptz, default now())

### activity_logs
- `id` (uuid, primary key)
- `user_id` (uuid, nullable, references auth.users) — the user who performed the action
- `action` (text, not null) — e.g. 'login', 'presentation_created', 'pptx_export', 'pdf_export'
- `details` (jsonb, nullable) — additional context
- `created_at` (timestamptz, default now())

### admin_audit_logs
- `id` (uuid, primary key)
- `admin_id` (uuid, not null, references auth.users) — the admin who performed the action
- `action` (text, not null) — e.g. 'admin_login', 'user_viewed', 'user_disabled'
- `target_user_id` (uuid, nullable) — the user affected by the admin action
- `details` (jsonb, nullable) — additional context
- `created_at` (timestamptz, default now())

## Security (RLS)
- visitor_events: anyone can INSERT, only admins can SELECT
- activity_logs: users INSERT their own, only admins can SELECT all
- admin_audit_logs: only admins can INSERT and SELECT
- profiles: existing policies already allow admin updates (recreated to include is_admin)

## Important Notes
1. All new tables have RLS enabled.
2. No existing data is modified or deleted.
3. Visitor tracking uses an anonymous localStorage-based ID — no PII collected.
4. Activity logs are scoped: users write their own, only admins read all.
*/

-- ── Recreate is_admin() function ──────────────────────────────────────────────
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

-- ── Add columns to profiles ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_login') THEN
    ALTER TABLE profiles ADD COLUMN last_login timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_activity') THEN
    ALTER TABLE profiles ADD COLUMN last_activity timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_disabled') THEN
    ALTER TABLE profiles ADD COLUMN is_disabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── visitor_events table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE visitor_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visitor_events_insert_any" ON visitor_events;
CREATE POLICY "visitor_events_insert_any"
ON visitor_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "visitor_events_select_admin" ON visitor_events;
CREATE POLICY "visitor_events_select_admin"
ON visitor_events FOR SELECT
TO authenticated
USING (is_admin());

-- ── activity_logs table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_insert_own" ON activity_logs;
CREATE POLICY "activity_logs_insert_own"
ON activity_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "activity_logs_select_admin" ON activity_logs;
CREATE POLICY "activity_logs_select_admin"
ON activity_logs FOR SELECT
TO authenticated
USING (is_admin());

-- ── admin_audit_logs table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_user_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_logs_insert_admin" ON admin_audit_logs;
CREATE POLICY "admin_audit_logs_insert_admin"
ON admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK (is_admin() AND auth.uid() = admin_id);

DROP POLICY IF EXISTS "admin_audit_logs_select_admin" ON admin_audit_logs;
CREATE POLICY "admin_audit_logs_select_admin"
ON admin_audit_logs FOR SELECT
TO authenticated
USING (is_admin());

-- ── Update profiles policies to include is_admin checks ──────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id OR is_admin())
WITH CHECK (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin"
ON profiles FOR DELETE
TO authenticated
USING (is_admin());

-- ── Update presentations policies to include is_admin ────────────────────────
DROP POLICY IF EXISTS "presentations_select_own" ON presentations;
CREATE POLICY "presentations_select_own"
ON presentations FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "presentations_delete_own" ON presentations;
CREATE POLICY "presentations_delete_own"
ON presentations FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR is_admin());

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_visitor_events_created_at ON visitor_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor_id ON visitor_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_is_disabled ON profiles(is_disabled);
