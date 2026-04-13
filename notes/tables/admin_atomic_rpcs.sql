-- Operacoes atomicas para administracao (users/roles) consumidas pelo backend-service.
-- Estas funcoes encapsulam operacoes multi-etapa em uma transacao unica do PostgreSQL.

CREATE OR REPLACE FUNCTION create_user_with_roles(
  p_name TEXT,
  p_email TEXT,
  p_password_hash TEXT,
  p_is_active BOOLEAN,
  p_role_ids UUID[]
)
RETURNS TABLE(result TEXT, id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_role_count INT;
BEGIN
  IF COALESCE(array_length(p_role_ids, 1), 0) > 0 THEN
    SELECT COUNT(*) INTO v_role_count FROM roles WHERE roles.id = ANY(p_role_ids);

    IF v_role_count <> array_length(p_role_ids, 1) THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  INSERT INTO users (name, email, password_hash, is_active)
  VALUES (p_name, p_email, p_password_hash, p_is_active)
  RETURNING users.id INTO v_user_id;

  IF COALESCE(array_length(p_role_ids, 1), 0) > 0 THEN
    INSERT INTO user_roles (user_id, role_id)
    SELECT v_user_id, UNNEST(p_role_ids);
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, v_user_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
$$;


CREATE OR REPLACE FUNCTION update_user_with_roles(
  p_id UUID,
  p_payload JSONB,
  p_role_ids UUID[],
  p_should_replace_roles BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(result TEXT, id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_role_count INT;
  v_user_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM users WHERE users.id = p_id) INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) = 'object' AND jsonb_object_length(p_payload) > 0 THEN
    UPDATE users
    SET
      name = CASE WHEN p_payload ? 'name' THEN NULLIF(p_payload->>'name', '') ELSE name END,
      email = CASE WHEN p_payload ? 'email' THEN NULLIF(p_payload->>'email', '') ELSE email END,
      password_hash = CASE WHEN p_payload ? 'password_hash' THEN NULLIF(p_payload->>'password_hash', '') ELSE password_hash END,
      is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::BOOLEAN ELSE is_active END,
      updated_at = NOW()
    WHERE users.id = p_id;
  END IF;

  IF p_should_replace_roles THEN
    IF COALESCE(array_length(p_role_ids, 1), 0) > 0 THEN
      SELECT COUNT(*) INTO v_role_count FROM roles WHERE roles.id = ANY(p_role_ids);

      IF v_role_count <> array_length(p_role_ids, 1) THEN
        RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
        RETURN;
      END IF;
    END IF;

    DELETE FROM user_roles WHERE user_roles.user_id = p_id;

    IF COALESCE(array_length(p_role_ids, 1), 0) > 0 THEN
      INSERT INTO user_roles (user_id, role_id)
      SELECT p_id, UNNEST(p_role_ids);
    END IF;
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, p_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
$$;


CREATE OR REPLACE FUNCTION create_role_with_permissions(
  p_name TEXT,
  p_hotel_id UUID,
  p_permission_ids UUID[]
)
RETURNS TABLE(result TEXT, id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_role_id UUID;
  v_permission_count INT;
BEGIN
  IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
    SELECT COUNT(*) INTO v_permission_count FROM permissions WHERE permissions.id = ANY(p_permission_ids);

    IF v_permission_count <> array_length(p_permission_ids, 1) THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  INSERT INTO roles (name, hotel_id)
  VALUES (p_name, p_hotel_id)
  RETURNING roles.id INTO v_role_id;

  IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, UNNEST(p_permission_ids);
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, v_role_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
$$;


CREATE OR REPLACE FUNCTION update_role_with_permissions(
  p_id UUID,
  p_payload JSONB,
  p_permission_ids UUID[],
  p_should_replace_permissions BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(result TEXT, id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_permission_count INT;
  v_role_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM roles WHERE roles.id = p_id) INTO v_role_exists;

  IF NOT v_role_exists THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) = 'object' AND jsonb_object_length(p_payload) > 0 THEN
    UPDATE roles
    SET
      name = CASE WHEN p_payload ? 'name' THEN NULLIF(p_payload->>'name', '') ELSE name END,
      hotel_id = CASE WHEN p_payload ? 'hotel_id' THEN NULLIF(p_payload->>'hotel_id', '')::UUID ELSE hotel_id END
    WHERE roles.id = p_id;
  END IF;

  IF p_should_replace_permissions THEN
    IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
      SELECT COUNT(*) INTO v_permission_count FROM permissions WHERE permissions.id = ANY(p_permission_ids);

      IF v_permission_count <> array_length(p_permission_ids, 1) THEN
        RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
        RETURN;
      END IF;
    END IF;

    DELETE FROM role_permissions WHERE role_permissions.role_id = p_id;

    IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT p_id, UNNEST(p_permission_ids);
    END IF;
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, p_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::UUID;
END;
$$;
