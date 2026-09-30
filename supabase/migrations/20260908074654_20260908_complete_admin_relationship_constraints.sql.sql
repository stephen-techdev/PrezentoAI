/*
# Complete Admin Relationship Constraints

1. Purpose
- Complete the database relationships required by the existing Admin Panel queries.
- These relationships allow Supabase to resolve profile information for presentations and user activity.

2. Modified Tables
- `presentations.user_id` references `profiles.id` and preserves existing rows.
- `activity_logs.user_id` references `profiles.id` and remains nullable for system activity.

3. Security
- No row-level security policies are changed.
- Existing admin policies continue to require the authenticated user's profile role to be `admin`.

4. Data Safety
- No rows, columns, or existing values are deleted or reset.
- Constraints are only added when missing.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'presentations_user_id_fkey'
  ) THEN
    ALTER TABLE public.presentations
      ADD CONSTRAINT presentations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_logs_user_id_fkey'
  ) THEN
    ALTER TABLE public.activity_logs
      ADD CONSTRAINT activity_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
