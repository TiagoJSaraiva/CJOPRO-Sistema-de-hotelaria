-- Operacoes atomicas para administracao (users/roles) consumidas pelo backend-service.
-- Estas funcoes encapsulam operacoes multi-etapa em uma transacao unica do PostgreSQL.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'admin_role_assignment_input'
  ) THEN
    CREATE TYPE admin_role_assignment_input AS (
      role_id UUID,
      hotel_id UUID
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION create_user_with_roles(
  p_name TEXT,
  p_email TEXT,
  p_password_hash TEXT,
  p_is_active BOOLEAN,
  p_role_assignments admin_role_assignment_input[]
)
RETURNS TABLE(result TEXT, id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_assignment_count INT;
  v_missing_count INT;
  v_invalid_count INT;
BEGIN
  IF COALESCE(array_length(p_role_assignments, 1), 0) > 0 THEN
    SELECT COUNT(*)
    INTO v_assignment_count
    FROM unnest(p_role_assignments) AS assignment;

    SELECT COUNT(*)
    INTO v_missing_count
    FROM unnest(p_role_assignments) AS assignment
    LEFT JOIN roles r ON r.id = assignment.role_id
    WHERE r.id IS NULL;

    IF v_missing_count > 0 THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;

    SELECT COUNT(*)
    INTO v_invalid_count
    FROM unnest(p_role_assignments) AS assignment
    JOIN roles r ON r.id = assignment.role_id
    WHERE
      (r.role_type = 'SYSTEM_ROLE' AND assignment.hotel_id IS NOT NULL)
      OR (r.role_type = 'HOTEL_ROLE' AND r.hotel_id IS NULL AND assignment.hotel_id IS NULL)
      OR (r.role_type = 'HOTEL_ROLE' AND r.hotel_id IS NOT NULL AND assignment.hotel_id IS NOT NULL AND assignment.hotel_id <> r.hotel_id)
      OR (r.role_type = 'HOTEL_ROLE' AND assignment.hotel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hotels h WHERE h.id = assignment.hotel_id));

    IF v_invalid_count > 0 THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  INSERT INTO users (name, email, password_hash, is_active)
  VALUES (p_name, p_email, p_password_hash, p_is_active)
  RETURNING users.id INTO v_user_id;

  IF COALESCE(array_length(p_role_assignments, 1), 0) > 0 THEN
    INSERT INTO user_roles (user_id, role_id, hotel_id)
    SELECT
      v_user_id,
      assignment.role_id,
      CASE
        WHEN r.role_type = 'SYSTEM_ROLE' THEN NULL
        WHEN r.hotel_id IS NOT NULL THEN r.hotel_id
        ELSE assignment.hotel_id
      END
    FROM unnest(p_role_assignments) AS assignment
    JOIN roles r ON r.id = assignment.role_id;
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
  p_role_assignments admin_role_assignment_input[],
  p_should_replace_roles BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(result TEXT, id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_missing_count INT;
  v_invalid_count INT;
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
    IF COALESCE(array_length(p_role_assignments, 1), 0) > 0 THEN
      SELECT COUNT(*)
      INTO v_missing_count
      FROM unnest(p_role_assignments) AS assignment
      LEFT JOIN roles r ON r.id = assignment.role_id
      WHERE r.id IS NULL;

      IF v_missing_count > 0 THEN
        RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
        RETURN;
      END IF;

      SELECT COUNT(*)
      INTO v_invalid_count
      FROM unnest(p_role_assignments) AS assignment
      JOIN roles r ON r.id = assignment.role_id
      WHERE
        (r.role_type = 'SYSTEM_ROLE' AND assignment.hotel_id IS NOT NULL)
        OR (r.role_type = 'HOTEL_ROLE' AND r.hotel_id IS NULL AND assignment.hotel_id IS NULL)
        OR (r.role_type = 'HOTEL_ROLE' AND r.hotel_id IS NOT NULL AND assignment.hotel_id IS NOT NULL AND assignment.hotel_id <> r.hotel_id)
        OR (r.role_type = 'HOTEL_ROLE' AND assignment.hotel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hotels h WHERE h.id = assignment.hotel_id));

      IF v_invalid_count > 0 THEN
        RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
        RETURN;
      END IF;
    END IF;

    DELETE FROM user_roles WHERE user_roles.user_id = p_id;

    IF COALESCE(array_length(p_role_assignments, 1), 0) > 0 THEN
      INSERT INTO user_roles (user_id, role_id, hotel_id)
      SELECT
        p_id,
        assignment.role_id,
        CASE
          WHEN r.role_type = 'SYSTEM_ROLE' THEN NULL
          WHEN r.hotel_id IS NOT NULL THEN r.hotel_id
          ELSE assignment.hotel_id
        END
      FROM unnest(p_role_assignments) AS assignment
      JOIN roles r ON r.id = assignment.role_id;
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
  p_role_type TEXT,
  p_hotel_id UUID,
  p_permission_ids UUID[]
)
RETURNS TABLE(result TEXT, id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_role_id UUID;
  v_permission_count INT;
  v_invalid_permission_count INT;
BEGIN
  IF p_role_type NOT IN ('SYSTEM_ROLE', 'HOTEL_ROLE') THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_role_type = 'SYSTEM_ROLE' AND p_hotel_id IS NOT NULL THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_hotel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hotels h WHERE h.id = p_hotel_id) THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF COALESCE(array_length(p_permission_ids, 1), 0) > 0 THEN
    SELECT COUNT(*) INTO v_permission_count FROM permissions WHERE permissions.id = ANY(p_permission_ids);

    IF v_permission_count <> array_length(p_permission_ids, 1) THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;

    SELECT COUNT(*)
    INTO v_invalid_permission_count
    FROM permissions
    WHERE permissions.id = ANY(p_permission_ids)
      AND permissions.type <> CASE WHEN p_role_type = 'SYSTEM_ROLE' THEN 'SYSTEM_PERMISSION' ELSE 'HOTEL_PERMISSION' END;

    IF v_invalid_permission_count > 0 THEN
      RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  INSERT INTO roles (name, role_type, hotel_id)
  VALUES (p_name, p_role_type, p_hotel_id)
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
  v_role_type TEXT;
  v_role_hotel_id UUID;
  v_effective_role_type TEXT;
  v_effective_hotel_id UUID;
  v_invalid_permission_count INT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM roles WHERE roles.id = p_id) INTO v_role_exists;

  IF NOT v_role_exists THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT role_type, hotel_id INTO v_role_type, v_role_hotel_id FROM roles WHERE roles.id = p_id;

  v_effective_role_type := COALESCE(NULLIF(p_payload->>'role_type', ''), v_role_type);

  IF v_effective_role_type NOT IN ('SYSTEM_ROLE', 'HOTEL_ROLE') THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_payload ? 'hotel_id' THEN
    v_effective_hotel_id := NULLIF(p_payload->>'hotel_id', '')::UUID;
  ELSE
    v_effective_hotel_id := v_role_hotel_id;
  END IF;

  IF v_effective_role_type = 'SYSTEM_ROLE' AND v_effective_hotel_id IS NOT NULL THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_effective_hotel_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hotels h WHERE h.id = v_effective_hotel_id) THEN
    RETURN QUERY SELECT 'not-found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) = 'object' AND jsonb_object_length(p_payload) > 0 THEN
    UPDATE roles
    SET
      name = CASE WHEN p_payload ? 'name' THEN NULLIF(p_payload->>'name', '') ELSE name END,
      role_type = CASE WHEN p_payload ? 'role_type' THEN NULLIF(p_payload->>'role_type', '') ELSE role_type END,
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

      SELECT COUNT(*)
      INTO v_invalid_permission_count
      FROM permissions
      WHERE permissions.id = ANY(p_permission_ids)
        AND permissions.type <> CASE WHEN v_effective_role_type = 'SYSTEM_ROLE' THEN 'SYSTEM_PERMISSION' ELSE 'HOTEL_PERMISSION' END;

      IF v_invalid_permission_count > 0 THEN
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
