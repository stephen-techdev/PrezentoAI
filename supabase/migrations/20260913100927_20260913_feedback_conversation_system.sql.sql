/*
# Feedback Conversation System — Messages, Admin Replies, Delete

## Purpose
Extends the existing feedback system into a conversation/thread model:
- Users can send additional messages within an existing feedback thread.
- Admins can reply to user feedback.
- Admins can delete feedback threads (and all associated messages).
- Users see their own feedback history with full conversation.

## New Tables
- `feedback_messages`
  - `id` (uuid, PK)
  - `feedback_id` (uuid, FK → feedback.id ON DELETE CASCADE) — which thread this belongs to
  - `sender_id` (uuid, FK → auth.users ON DELETE CASCADE) — who sent the message
  - `sender_role` (text, NOT NULL) — 'user' or 'admin'
  - `message` (text, NOT NULL) — the reply content
  - `created_at` (timestamptz, NOT NULL, DEFAULT now())

## Security
- RLS ENABLED on `feedback_messages` — no direct policies for anon.
- SELECT: authenticated users can see messages for their own feedback threads; admins can see all.
- INSERT: authenticated users can add messages to their own threads; admins can add messages to any thread.
- DELETE: only admins can delete (via cascade from feedback deletion).
- Two SECURITY DEFINER functions:
  1. `delete_feedback(feedback_id uuid)` — admin-only, deletes the feedback thread + all messages via cascade.
  2. `add_feedback_message(feedback_id uuid, message text)` — inserts a message, auto-determines sender role (admin vs user) by checking the profiles table.

## Important Notes
1. The original `feedback.message` column remains as the first/initial message of the thread.
2. `feedback_messages` stores subsequent replies (both user and admin).
3. When admin deletes a feedback row, CASCADE removes all associated messages automatically.
4. The `add_feedback_message` function checks if the caller is an admin (via profiles.role) to set sender_role.
5. Users can only add messages to threads they own.
6. The `delete_feedback` function verifies admin role before deleting.
*/

CREATE TABLE IF NOT EXISTS feedback_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL DEFAULT 'user',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;

-- Index for fast lookup by feedback thread
CREATE INDEX IF NOT EXISTS idx_feedback_messages_feedback_id ON feedback_messages(feedback_id);

-- ── RLS Policies for feedback_messages ───────────────────────────────────────

-- SELECT: users can see messages in their own threads; admins can see all
DROP POLICY IF EXISTS "select_own_or_admin_feedback_messages" ON feedback_messages;
CREATE POLICY "select_own_or_admin_feedback_messages"
ON feedback_messages FOR SELECT
TO authenticated
USING (
  auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM feedback
    WHERE feedback.id = feedback_messages.feedback_id
    AND feedback.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- INSERT: users can add messages to their own threads; admins can reply to any
DROP POLICY IF EXISTS "insert_feedback_messages" ON feedback_messages;
CREATE POLICY "insert_feedback_messages"
ON feedback_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM feedback
    WHERE feedback.id = feedback_messages.feedback_id
    AND feedback.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- ── Function: Delete feedback (admin only) ───────────────────────────────────
-- Verifies the caller is an admin, then deletes the feedback row.
-- CASCADE on feedback_messages.feedback_id automatically removes all messages.

CREATE OR REPLACE FUNCTION delete_feedback(p_feedback_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  DELETE FROM feedback WHERE id = p_feedback_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Feedback not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'error', null);
END;
$$;

GRANT EXECUTE ON FUNCTION delete_feedback(uuid) TO authenticated;

-- ── Function: Add a feedback message (user or admin) ─────────────────────────
-- Auto-detects whether the caller is an admin or the thread owner.
-- Sets sender_role accordingly. Returns the inserted row.

CREATE OR REPLACE FUNCTION add_feedback_message(p_feedback_id uuid, p_message text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_sender_role text;
  v_is_owner boolean;
  v_inserted jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_message IS NULL OR trim(p_message) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message cannot be empty');
  END IF;

  -- Check if caller is admin
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE profiles.id = v_user_id AND profiles.role = 'admin'
  ) INTO v_is_admin;

  -- Check if caller owns this feedback thread
  SELECT EXISTS(
    SELECT 1 FROM feedback WHERE feedback.id = p_feedback_id AND feedback.user_id = v_user_id
  ) INTO v_is_owner;

  IF NOT v_is_admin AND NOT v_is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  v_sender_role := CASE WHEN v_is_admin THEN 'admin' ELSE 'user' END;

  INSERT INTO feedback_messages (feedback_id, sender_id, sender_role, message)
  VALUES (p_feedback_id, v_user_id, v_sender_role, trim(p_message))
  RETURNING jsonb_build_object(
    'id', id,
    'feedback_id', feedback_id,
    'sender_id', sender_id,
    'sender_role', sender_role,
    'message', message,
    'created_at', created_at
  ) INTO v_inserted;

  RETURN jsonb_build_object('success', true, 'error', null, 'message', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION add_feedback_message(uuid, text) TO authenticated;
