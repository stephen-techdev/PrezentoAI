/*
# Fix Remaining Security Warnings

## Summary
Fixes the remaining security advisor warnings:
1. Revokes EXECUTE on handle_new_user() from anon and authenticated — this function
   is a trigger that runs on new user signup via Supabase auth, not a callable RPC.
2. Sets explicit search_path on update_updated_at() and update_profile_updated_at()
   trigger functions to remove the mutable search_path warning.

## Functions Modified
- `public.handle_new_user()` — REVOKE EXECUTE from PUBLIC, anon, authenticated
- `public.update_updated_at()` — set search_path to public
- `public.update_profile_updated_at()` — set search_path to public
*/

-- handle_new_user is a trigger function, not a callable RPC.
-- Revoke direct execute access from all roles (triggers still work via the owner).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Set explicit search_path on trigger functions
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_profile_updated_at() SET search_path = public;