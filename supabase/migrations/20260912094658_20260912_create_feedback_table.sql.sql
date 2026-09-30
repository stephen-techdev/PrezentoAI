/*
# Create user feedback / report issue table

## Purpose
Allows normal users to submit feedback, bug reports, feature requests, and other issues.
Admins can view all feedback, see details, and manage status (open / in_progress / resolved).

## New Tables
- `feedback`
  - `id` (uuid, PK) — unique feedback ID
  - `user_id` (uuid, NOT NULL, DEFAULT auth.uid()) — the user who submitted the feedback
  - `user_name` (text) — denormalized name for admin display
  - `user_email` (text) — denormalized email for admin display
  - `feedback_type` (text, NOT NULL) — one of: general, problem, bug, feature_request, other
  - `message` (text, NOT NULL) — the user's message
  - `status` (text, NOT NULL, DEFAULT 'open') — one of: open, in_progress, resolved
  - `created_at` (timestamptz, DEFAULT now()) — submission timestamp
  - `updated_at` (timestamptz, DEFAULT now()) — last status change

## Security (RLS)
- Enable RLS on `feedback`.
- SELECT: authenticated users can read only their own feedback rows.
  Admins can read all feedback (checked via profiles.role = 'admin').
- INSERT: authenticated users can insert only their own feedback.
- UPDATE: only admins can update feedback (to change status).
  Users cannot change their own feedback status.
- DELETE: only admins can delete feedback.

## Important Notes
1. `user_id` defaults to `auth.uid()` so inserts from the client work without passing it explicitly.
2. Admin access is granted through a subquery check on `profiles.role = 'admin'`.
3. Users can submit unlimited feedback messages (no per-user limit).
4. The dashboard "Feedback" count should sum rows where status IN ('open', 'in_progress').
*/

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  feedback_type text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can read their own feedback; admins can read all feedback
DROP POLICY IF EXISTS "select_own_or_admin_feedback" ON feedback;
CREATE POLICY "select_own_or_admin_feedback"
ON feedback FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Users can insert only their own feedback
DROP POLICY IF EXISTS "insert_own_feedback" ON feedback;
CREATE POLICY "insert_own_feedback"
ON feedback FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Only admins can update feedback (status changes)
DROP POLICY IF EXISTS "update_admin_feedback" ON feedback;
CREATE POLICY "update_admin_feedback"
ON feedback FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Only admins can delete feedback
DROP POLICY IF EXISTS "delete_admin_feedback" ON feedback;
CREATE POLICY "delete_admin_feedback"
ON feedback FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Index for admin queries (filter by status)
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
