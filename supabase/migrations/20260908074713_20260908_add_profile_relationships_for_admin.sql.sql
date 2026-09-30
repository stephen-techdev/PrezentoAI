/*
# Add Profile Relationships for Admin Queries

1. Purpose
- Add non-destructive relationships from admin-visible records to `profiles`.
- The existing ownership relationships correctly point to `auth.users`, but the Admin Panel needs profile fields such as name, username, and email.

2. Modified Tables
- `presentations.user_id` gets an additional relationship to `profiles.id`.
- `activity_logs.user_id` gets an additional relationship to `profiles.id`.
- `admin_audit_logs.admin_id` gets an additional relationship to `profiles.id`.

3. Security
- No RLS policies or privileges are changed.
- Existing admin-only policies remain responsible for authorization.

4. Data Safety
- Existing auth relationships remain unchanged.
- No rows, columns, or values are deleted or reset.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presentations_profile_user_id_fkey') THEN
    ALTER TABLE public.presentations
      ADD CONSTRAINT presentations_profile_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_logs_profile_user_id_fkey') THEN
    ALTER TABLE public.activity_logs
      ADD CONSTRAINT activity_logs_profile_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_admin_profile_fkey') THEN
    ALTER TABLE public.admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_admin_profile_fkey
      FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
