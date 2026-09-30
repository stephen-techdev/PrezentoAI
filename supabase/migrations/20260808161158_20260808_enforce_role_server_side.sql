/*
# Enforce admin role server-side — prevent self-escalation

## Overview
This migration closes a security gap where any authenticated user could change
their own `role` column to `admin` via the Supabase client. The existing RLS
UPDATE policy on profiles only checked row ownership (auth.uid() = id), not
which columns were being modified, so a user could send
`{ role: 'admin' }` in an update and escalate themselves.

## Security Changes
1. Adds a BEFORE UPDATE trigger on `profiles` that silently reverts any
   `role` column change attempted by a non-admin. If the current user is
   not an admin and tries to change `NEW.role`, the trigger resets
   `NEW.role` to `OLD.role` before the row is written.
2. The `is_admin()` helper (already SECURITY DEFINER) is used for the check,
   so the enforcement happens at the database level and cannot be bypassed
   by changing frontend code, URL parameters, or client-side state.

## Important Notes
1. This does NOT affect admins — they can still change any user's role.
2. This does NOT affect profile updates of other fields (name, avatar, etc.)
   — users retain full control over their own non-role profile data.
3. The trigger is idempotent and safe to re-run.
*/

CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If a non-admin user attempts to change the role column, revert it.
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON profiles;
CREATE TRIGGER profiles_prevent_role_escalation
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION prevent_role_escalation();
