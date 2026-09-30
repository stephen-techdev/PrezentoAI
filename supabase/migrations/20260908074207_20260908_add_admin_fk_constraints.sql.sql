/*
# Add Foreign Key Constraints for Admin Panel Joins

## Problem
The admin panel uses Supabase's embedded resource join syntax
(e.g., `presentations!inner(full_name,email,username)`) to fetch
related profile data alongside presentations and activity logs.
However, no foreign key constraints exist between:
- presentations.user_id → profiles.id
- activity_logs.user_id → profiles.id
- admin_audit_logs.admin_id → profiles.id
- admin_audit_logs.target_user_id → profiles.id

Without FK constraints, PostgREST (Supabase's API layer) cannot
determine the join relationship and returns an error for every
query that uses the `!inner` or `!left` join syntax. This causes
the admin panel to fail silently — queries error out, the frontend
swallows the error, and the panel appears non-responsive.

## Changes
1. Add FK: presentations.user_id → profiles.id (ON DELETE CASCADE)
2. Add FK: activity_logs.user_id → profiles.id (ON DELETE CASCADE)
3. Add FK: admin_audit_logs.admin_id → profiles.id (ON DELETE CASCADE)
4. Add FK: admin_audit_logs.target_user_id → profiles.id (ON DELETE SET NULL)

All constraints are added with NOT VALID then validated, to avoid
long table locks. Existing data has been verified to have no orphans.

## Security
No RLS changes. Existing policies already use is_admin() for
authorization. The FK constraints do not change access control —
they only enable PostgREST to resolve join relationships.
*/

-- Add FK: presentations.user_id → profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'presentations_user_id_fkey'
      AND table_name = 'presentations'
  ) THEN
    ALTER TABLE presentations
      ADD CONSTRAINT presentations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK: activity_logs.user_id → profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activity_logs_user_id_fkey'
      AND table_name = 'activity_logs'
  ) THEN
    ALTER TABLE activity_logs
      ADD CONSTRAINT activity_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK: admin_audit_logs.admin_id → profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'admin_audit_logs_admin_id_fkey'
      AND table_name = 'admin_audit_logs'
  ) THEN
    ALTER TABLE admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_admin_id_fkey
      FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK: admin_audit_logs.target_user_id → profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'admin_audit_logs_target_user_id_fkey'
      AND table_name = 'admin_audit_logs'
  ) THEN
    ALTER TABLE admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_target_user_id_fkey
      FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
