-- Add UPDATE policy for activity_logs (users can update their own logs)
CREATE POLICY "activity_logs_update_own"
  ON activity_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy for activity_logs (users can delete their own logs)
CREATE POLICY "activity_logs_delete_own"
  ON activity_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add DELETE policy for admin_audit_logs (admin only)
CREATE POLICY "admin_audit_logs_delete_admin"
  ON admin_audit_logs FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add UPDATE policy for admin_audit_logs (admin only)
CREATE POLICY "admin_audit_logs_update_admin"
  ON admin_audit_logs FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Ensure the handle_new_user trigger handles the case where
-- raw_user_meta_data might be null
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
END;
$function$;
