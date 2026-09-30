-- Change the default admin seed account to stephen@prezento.app
-- (keeps accepting an explicit email + bcrypt hash via arguments)
CREATE OR REPLACE FUNCTION seed_admin_account(
  admin_email text DEFAULT 'stephen@prezento.app',
  admin_password_hash text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_hash text;
BEGIN
  IF admin_password_hash IS NOT NULL THEN
    v_hash := admin_password_hash;
  ELSE
    v_hash := crypt('PrezentoAdmin@2026!', gen_salt('bf', 10));
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(admin_email);

  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = v_hash,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        banned_until = NULL,
        deleted_at = NULL,
        updated_at = now()
    WHERE id = v_user_id;

    UPDATE profiles
    SET role = 'admin', is_disabled = false
    WHERE id = v_user_id;
  ELSE
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token,
      recovery_token, email_change_token_new,
      email_change_token_current, phone_change_token,
      phone, phone_change, phone_change_token,
      reauthentication_token, is_sso_user, is_anonymous
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      lower(admin_email),
      v_hash, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Administrator'),
      now(), now(),
      '', '', '', '', '',
      '', '', '',
      '', false, false
    );

    INSERT INTO profiles (id, email, full_name, role, is_disabled)
    VALUES (v_user_id, lower(admin_email), 'Administrator', 'admin', false)
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin', is_disabled = false;
  END IF;
END;
$$;
