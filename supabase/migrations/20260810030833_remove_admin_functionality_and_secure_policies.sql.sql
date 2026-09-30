/*
# Remove Admin Functionality and Secure RLS Policies

## Summary
Temporarily removes admin-specific database logic from Prezento AI while keeping
normal user authentication fully functional. This migration:
- Drops RLS policies that had `OR is_admin()` clauses or admin-only access
- Removes the is_admin() SECURITY DEFINER function (was callable by anon + authenticated)
- Removes the prevent_role_escalation() SECURITY DEFINER trigger function
- Drops the profiles_prevent_role_escalation trigger
- Creates new strict ownership-only RLS policies (no admin bypass)
- Removes the idx_profiles_role index (role column no longer used for access control)

## Important Notes
1. The `role` column on `profiles` is NOT dropped (data safety — never DROP columns).
   It remains but is no longer referenced by any policy or function.
2. All policies now use strict `auth.uid()` ownership checks — no admin bypass.
3. Users can only access their own profile and their own presentations.
4. Profile deletion is blocked for all users via RLS (no DELETE policy = no access).
5. Presentations INSERT and UPDATE policies were already ownership-only — unchanged.
*/

-- ── Step 1: Drop ALL existing policies on both tables ────────────────────────

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

DROP POLICY IF EXISTS "presentations_select_own" ON presentations;
DROP POLICY IF EXISTS "presentations_delete_own" ON presentations;
DROP POLICY IF EXISTS "presentations_insert_own" ON presentations;
DROP POLICY IF EXISTS "presentations_update_own" ON presentations;

-- ── Step 2: Drop admin trigger and functions ─────────────────────────────────

DROP TRIGGER IF EXISTS "profiles_prevent_role_escalation" ON profiles;
DROP FUNCTION IF EXISTS public.prevent_role_escalation();
DROP FUNCTION IF EXISTS public.is_admin();

-- ── Step 3: Drop admin-only index ────────────────────────────────────────────

DROP INDEX IF EXISTS idx_profiles_role;

-- ── Step 4: Create new strict ownership-only policies ────────────────────────

-- profiles: SELECT
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- profiles: INSERT
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- profiles: UPDATE
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- profiles: DELETE — no policy (no user can delete profiles via Data API)

-- presentations: SELECT
CREATE POLICY "presentations_select_own"
  ON presentations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- presentations: INSERT
CREATE POLICY "presentations_insert_own"
  ON presentations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- presentations: UPDATE
CREATE POLICY "presentations_update_own"
  ON presentations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- presentations: DELETE
CREATE POLICY "presentations_delete_own"
  ON presentations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);