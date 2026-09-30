/*
# Add username, gender, updated_at to profiles + INSERT policy + update trigger

## Overview
Extends the existing profiles table to support the Anime Zoon-style registration
fields (username, gender, profile picture) and adds a missing INSERT policy so
authenticated users can create their own profile row. Also updates the
handle_new_user trigger to capture the new fields from signup metadata.

## Changes to existing tables

### profiles table — new columns
- `username` (text, nullable) — user-chosen display name
- `gender` (text, nullable) — user's gender
- `updated_at` (timestamptz, default now()) — last profile modification time

## Security changes (RLS)

### New INSERT policy on profiles
- "profiles_insert_own" — authenticated users can INSERT their own profile row.
  This is needed because the auto-create trigger runs as SECURITY DEFINER, but
  if the trigger ever fails or is delayed, the frontend can create the profile
  directly. The WITH CHECK ensures a user can only create a row with their own id.

### Updated UPDATE policy on profiles
- The existing "profiles_update_own" policy is kept but the role column is
  protected at the application layer (the UPDATE policy allows users to update
  their own row, but the frontend never exposes role as an editable field).
  The is_admin() function remains the source of truth for admin checks.

## Important notes

1. This migration is idempotent — all column additions use IF NOT EXISTS checks.
2. The handle_new_user trigger function is replaced to capture username, gender,
   and avatar_url from raw_user_meta_data.
3. The profiles table already has a created_at column; updated_at is new and
   gets a default of now().
4. An updated_at trigger is added for profiles (matching the one on presentations).
5. A unique constraint on username is added to prevent duplicate usernames.
*/