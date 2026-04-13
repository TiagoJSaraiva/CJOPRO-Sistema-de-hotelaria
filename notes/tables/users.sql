CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identidade
  name              VARCHAR(150) NOT NULL,
  email             VARCHAR(150) UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL, -- Hash gerado no backend

  -- Multi-tenant
  tenant_id         UUID NULL,  -- NULL = super admin

  -- Status
  is_active         BOOLEAN DEFAULT TRUE,

  -- Segurança
  last_login_at     TIMESTAMP WITH TIME ZONE,
  failed_attempts   INT DEFAULT 0,
  locked_until      TIMESTAMP WITH TIME ZONE,

  -- Auditoria
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- FK
  FOREIGN KEY (tenant_id) REFERENCES hotels(id)
);

CREATE TABLE roles ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE, -- NULL = role global
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE (user_id, role_id)
);

-- Por exemplo, usuário cuja role é "admin" tem permissão "manage_users", "manage_hotels", etc. Já usuário com role "staff" tem permissão "view_bookings", etc.
-- Um usuário pode ter múltiplas roles, e uma role pode ter múltiplas permissões. Por isso a tabela intermediária user_roles, e a tabela permissions.

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE (role_id, permission_id)
);

