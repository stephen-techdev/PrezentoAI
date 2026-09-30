-- Allow admins to delete any user's activity logs (needed for user deletion)
CREATE POLICY "activity_logs_delete_admin" ON activity_logs
  FOR DELETE TO authenticated
  USING (is_admin());
