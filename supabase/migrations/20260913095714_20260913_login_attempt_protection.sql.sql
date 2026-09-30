/*
# Login Attempt Protection (5-attempt lockout)

## Purpose
Tracks failed login attempts per email address and enforces a temporary 15-minute lockout
after 5 consecutive incorrect password attempts. This protects both user and admin login flows.

## New Tables
- `login_attempts`
  - `id` (uuid, PK)
  - `email` (text, NOT NULL) — the email address being attempted (lowercased)
  - `failed_count` (int, NOT NULL, DEFAULT 0) — consecutive failed attempts
  - `locked_until` (timestamptz, NULL) — when the lockout expires; NULL = not locked
  - `last_attempt_at` (timestamptz, NOT NULL, DEFAULT now()) — timestamp of last attempt
  - `created_at` (timestamptz, NOT NULL, DEFAULT now())

## Security
- RLS is ENABLED on `login_attempts` — no direct read/write access for any role.
- All access is through three SECURITY DEFINER functions that run with elevated privileges:
  1. `check_login_attempt(email text)` — returns lockout status + remaining attempts
  2. `record_failed_login(email text)` — increments failed count, locks after 5
  3. `reset_login_attempts(email text)` — resets counter to 0 on successful login
- These functions are callable by `anon` and `authenticated` roles (needed before sign-in).
- The functions do NOT expose password hashes or any sensitive auth data.

## Important Notes
1. Tracking is by email address, not by user ID — this allows lockout even if the email
   doesn't correspond to an existing account (prevents user enumeration).
2. The lockout is 15 minutes. After it expires, the counter resets automatically.
3. On successful login, the counter resets to 0 immediately.
4. The `check_login_attempt` function auto-resets the counter if the lockout has expired
   when called, so the user gets a fresh 5 attempts after the 15-minute window.
5. All functions use `LOWER(email)` for case-insensitive matching.
*/

CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  failed_count int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS — no direct access, only through SECURITY DEFINER functions
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Unique index on email for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts (LOWER(email));

-- ── Function 1: Check login attempt status ──────────────────────────────────
-- Returns: { locked: bool, remaining_attempts: int, locked_until: timestamptz | null }
-- If a lockout has expired, resets the counter automatically.

CREATE OR REPLACE FUNCTION check_login_attempt(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record login_attempts%ROWTYPE;
  v_locked boolean := false;
  v_remaining int := 5;
  v_locked_until timestamptz := NULL;
BEGIN
  SELECT * INTO v_record FROM login_attempts WHERE LOWER(email) = LOWER(p_email);

  -- If no record exists, no attempts have been made
  IF NOT FOUND THEN
    RETURN jsonb_build_object('locked', false, 'remaining_attempts', 5, 'locked_until', NULL);
  END IF;

  -- Check if currently locked
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > now() THEN
    v_locked := true;
    v_remaining := 0;
    v_locked_until := v_record.locked_until;
  -- If lockout has expired, reset the counter
  ELSIF v_record.locked_until IS NOT NULL AND v_record.locked_until <= now() THEN
    UPDATE login_attempts 
    SET failed_count = 0, locked_until = NULL, last_attempt_at = now()
    WHERE id = v_record.id;
    v_locked := false;
    v_remaining := 5;
  ELSE
    -- Not locked, calculate remaining attempts
    v_remaining := GREATEST(0, 5 - v_record.failed_count);
  END IF;

  RETURN jsonb_build_object(
    'locked', v_locked,
    'remaining_attempts', v_remaining,
    'locked_until', v_locked_until
  );
END;
$$;

-- ── Function 2: Record a failed login attempt ────────────────────────────────
-- Increments the failed count. If count reaches 5, sets locked_until to now() + 15 minutes.
-- Returns: { locked: bool, remaining_attempts: int, locked_until: timestamptz | null }

CREATE OR REPLACE FUNCTION record_failed_login(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record login_attempts%ROWTYPE;
  v_failed_count int;
  v_locked boolean := false;
  v_remaining int;
  v_locked_until timestamptz := NULL;
BEGIN
  SELECT * INTO v_record FROM login_attempts WHERE LOWER(email) = LOWER(p_email);

  IF NOT FOUND THEN
    -- First failed attempt — create record
    INSERT INTO login_attempts (email, failed_count, last_attempt_at)
    VALUES (LOWER(p_email), 1, now())
    RETURNING * INTO v_record;
  ELSE
    -- If lockout has expired, reset first
    IF v_record.locked_until IS NOT NULL AND v_record.locked_until <= now() THEN
      v_record.failed_count := 0;
      v_record.locked_until := NULL;
    END IF;

    -- If already locked, don't increment further
    IF v_record.locked_until IS NOT NULL AND v_record.locked_until > now() THEN
      RETURN jsonb_build_object(
        'locked', true,
        'remaining_attempts', 0,
        'locked_until', v_record.locked_until
      );
    END IF;

    -- Increment failed count
    v_failed_count := v_record.failed_count + 1;
    
    IF v_failed_count >= 5 THEN
      v_locked_until := now() + interval '15 minutes';
      v_locked := true;
      v_remaining := 0;
      
      UPDATE login_attempts 
      SET failed_count = v_failed_count, locked_until = v_locked_until, last_attempt_at = now()
      WHERE id = v_record.id;
    ELSE
      v_remaining := 5 - v_failed_count;
      UPDATE login_attempts 
      SET failed_count = v_failed_count, last_attempt_at = now()
      WHERE id = v_record.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'locked', v_locked,
    'remaining_attempts', v_remaining,
    'locked_until', v_locked_until
  );
END;
$$;

-- ── Function 3: Reset login attempts on successful login ─────────────────────
-- Clears the failed counter and lockout for the given email.

CREATE OR REPLACE FUNCTION reset_login_attempts(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE login_attempts 
  SET failed_count = 0, locked_until = NULL, last_attempt_at = now()
  WHERE LOWER(email) = LOWER(p_email);
END;
$$;

-- Grant execute on all three functions to anon and authenticated roles
-- (anon is needed because login happens before authentication)
GRANT EXECUTE ON FUNCTION check_login_attempt(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_failed_login(text) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_login_attempts(text) TO authenticated;

-- Also grant to anon for record_failed_login and reset_login_attempts since
-- the login form runs as anon before the user is authenticated
GRANT EXECUTE ON FUNCTION record_failed_login(text) TO anon;
GRANT EXECUTE ON FUNCTION reset_login_attempts(text) TO anon;
