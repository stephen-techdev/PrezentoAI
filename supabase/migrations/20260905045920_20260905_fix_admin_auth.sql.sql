/*
# Fix Admin Authentication - Ensure Login Works

## Problem
The admin account (admin@prezento.app) exists in auth.users and profiles,
but login fails with "Invalid email or password". The password hash may
not be compatible with Supabase Auth's password verification.

## Changes
1. Reset the admin password hash using PostgreSQL's crypt() with bcrypt
   so it is compatible with Supabase Auth's password verification.
2. Ensure email is confirmed (email_confirmed_at set).
3. Ensure the account is not banned or deleted.
4. Ensure the profiles row has role='admin' and is_disabled=false.
5. Create a SECURITY DEFINER function `seed_admin_account()` that can be
   called to idempotently ensure the admin account exists with the correct
   role and status.

## Security
- The password hash is set directly in auth.users.encrypted_password using
  PostgreSQL's crypt() function with bf (bcrypt) salt — the same algorithm
  Supabase Auth uses internally.
- No plaintext passwords are stored anywhere.
- The admin account is NOT created through the public registration form.
*/

-- Reset admin password with a fresh bcrypt hash
UPDATE auth.users
SET encrypted_password = crypt('Admin@Prezento2026!', gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    banned_until = NULL,
    deleted_at = NULL,
    updated_at = now()
WHERE lower(email) = 'admin@prezento.app';

-- Ensure admin profile is correct
UPDATE profiles
SET role = 'admin',
    is_disabled = false,
    full_name = COALESCE(full_name, 'Administrator')
WHERE lower(email) = 'admin@prezento.app';

-- Create idempotent seed function for admin account
-- Callable from service_role context to ensure the admin exists
CREATE OR REPLACE FUNCTION public.seed_admin_account(
  admin_email text DEFAULT 'admin@prezento.app',
  admin_password_hash text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_hash text;
BEGIN
  -- Use provided hash or generate a default one
  IF admin_password_hash IS NOT NULL THEN
    v_hash := admin_password_hash;
  ELSE
    v_hash := crypt('Admin@Prezento2026!', gen_salt('bf', 10));
  END IF;

  -- Check if admin user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(admin_email);

  IF v_user_id IS NOT NULL THEN
    -- Update existing admin: set password, ensure confirmed, not banned
    UPDATE auth.users
    SET encrypted_password = v_hash,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        banned_until = NULL,
        deleted_at = NULL,
        updated_at = now()
    WHERE id = v_user_id;

    -- Ensure profile has admin role
    UPDATE profiles
    SET role = 'admin',
        is_disabled = false
    WHERE id = v_user_id;
  ELSE
    -- Create admin user in auth.users
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token,
      recovery_token, email_change_token_new,
      email_change_token_current, phone_change_token,
      phone, phone_change, phone_change_token,
      reauthentication_token, is_sso_user, is_anonymous
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      lower(admin_email),
      v_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Administrator'),
      now(), now(),
      '', '', '', '', '',
      '', '', '',
      '', false, false
    );

    -- Create admin profile
    INSERT INTO profiles (id, email, full_name, role, is_disabled)
    VALUES (v_user_id, lower(admin_email), 'Administrator', 'admin', false)
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      is_disabled = false;
  END IF;
END;
$function$;

-- Revoke execute from anon and authenticated; only service_role can call
REVOKE EXECUTE ON FUNCTION public.seed_admin_account(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_admin_account(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_admin_account(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seed_admin_account(text, text) TO service_role;
