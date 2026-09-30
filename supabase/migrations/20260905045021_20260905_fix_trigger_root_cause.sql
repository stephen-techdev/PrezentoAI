-- Fix root cause: simplify handle_new_user trigger to avoid
-- ON CONFLICT (id) DO UPDATE which can violate profiles_email_key unique constraint.
-- Use ON CONFLICT (id) DO NOTHING instead — the profile is created once on signup.

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
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Ensure existing users without a role get 'user'
UPDATE profiles SET role = 'user' WHERE role IS NULL OR role = '';

-- Ensure admin account is correct
UPDATE profiles SET role = 'admin', is_disabled = false
WHERE email = 'admin@prezento.app';

-- Fix admin's raw_app_meta_data if it was empty
UPDATE auth.users
SET raw_app_meta_data = '{"provider":"email","providers":["email"]}',
    updated_at = now()
WHERE email = 'admin@prezento.app'
  AND (raw_app_meta_data IS NULL OR raw_app_meta_data = '{}'::jsonb);
