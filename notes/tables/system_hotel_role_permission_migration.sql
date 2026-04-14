-- Migration: SYSTEM/HOTEL typing for permissions and roles, plus hotel-aware user role assignments.
-- Execute in Supabase SQL Editor in a maintenance window.

BEGIN;

-- 1) Permissions type
ALTER TABLE permissions
  ADD COLUMN IF NOT EXISTS type VARCHAR(20);

UPDATE permissions
SET type = 'SYSTEM_PERMISSION'
WHERE type IS NULL;

ALTER TABLE permissions
  ALTER COLUMN type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_permissions_type'
  ) THEN
    ALTER TABLE permissions
      ADD CONSTRAINT ck_permissions_type
      CHECK (type IN ('SYSTEM_PERMISSION', 'HOTEL_PERMISSION'));
  END IF;
END $$;

-- 2) Roles type
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS role_type VARCHAR(20);

UPDATE roles
SET role_type = CASE
  WHEN hotel_id IS NULL THEN 'SYSTEM_ROLE'
  ELSE 'HOTEL_ROLE'
END
WHERE role_type IS NULL;

ALTER TABLE roles
  ALTER COLUMN role_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_roles_type'
  ) THEN
    ALTER TABLE roles
      ADD CONSTRAINT ck_roles_type
      CHECK (role_type IN ('SYSTEM_ROLE', 'HOTEL_ROLE'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_roles_type_hotel'
  ) THEN
    ALTER TABLE roles
      ADD CONSTRAINT ck_roles_type_hotel
      CHECK (
        (role_type = 'SYSTEM_ROLE' AND hotel_id IS NULL)
        OR role_type = 'HOTEL_ROLE'
      );
  END IF;
END $$;

-- 3) User role assignments include assignment hotel context
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS hotel_id UUID NULL REFERENCES hotels(id) ON DELETE CASCADE;

-- Backfill: explicit hotel role -> copy role.hotel_id, system role -> null
UPDATE user_roles ur
SET hotel_id = CASE
  WHEN r.role_type = 'HOTEL_ROLE' AND r.hotel_id IS NOT NULL THEN r.hotel_id
  ELSE ur.hotel_id
END
FROM roles r
WHERE r.id = ur.role_id;

-- Remove old uniqueness and enforce role+hotel context uniqueness
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_id_key'
  ) THEN
    ALTER TABLE user_roles DROP CONSTRAINT user_roles_user_id_role_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_id_hotel_id_key'
  ) THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT user_roles_user_id_role_id_hotel_id_key
      UNIQUE (user_id, role_id, hotel_id);
  END IF;
END $$;

COMMIT;

-- Optional sanity checks
-- SELECT type, COUNT(*) FROM permissions GROUP BY type;
-- SELECT role_type, COUNT(*) FROM roles GROUP BY role_type;
-- SELECT COUNT(*) FROM user_roles WHERE hotel_id IS NOT NULL;
