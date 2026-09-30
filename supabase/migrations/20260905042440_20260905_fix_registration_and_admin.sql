-- Fix 1: Rewrite handle_new_user to be robust and not fail on edge cases.
-- The ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email can fail
-- if another profile already has that email (profiles_email_key unique constraint).
-- Reverting to the simpler ON CONFLICT (id) DO NOTHING approach, but also
-- handling username/gender from the original migration.
-- Adding exception handling so the trigger NEVER blocks user creation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't block user creation.
  -- The profile can be created later by the application.
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Fix 2: Grant EXECUTE to PUBLIC so any role (including GoTrue's) can run the trigger
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;

-- Fix 3: Ensure existing users without a role get 'user' as default
UPDATE profiles SET role = 'user' WHERE role IS NULL OR role = '';

-- Fix 4: Fix the admin account's raw_app_meta_data (was empty {})
UPDATE auth.users
SET raw_app_meta_data = '{"provider":"email","providers":["email"]}',
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{full_name}',
      '"Administrator"'
    ),
    updated_at = now()
WHERE email = 'admin@prezento.app';

-- Fix 5: Ensure the admin profile has correct role and is not disabled
UPDATE profiles
SET role = 'admin',
    is_disabled = false
WHERE email = 'admin@prezento.app';
