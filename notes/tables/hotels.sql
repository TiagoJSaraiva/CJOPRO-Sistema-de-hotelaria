CREATE TABLE hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  name VARCHAR(150) NOT NULL,
  legal_name VARCHAR(150),
  tax_id VARCHAR(20), -- CNPJ

  -- Contato
  email VARCHAR(150),
  phone VARCHAR(20),

  -- Endereço
  address_line VARCHAR(200),
  address_number VARCHAR(20),
  address_complement VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(50),
  country VARCHAR(50),
  zip_code VARCHAR(20),

  -- Configurações operacionais
  checkin_time TIME,
  checkout_time TIME,
  timezone VARCHAR(50),
  currency VARCHAR(10),

  -- Configurações do sistema
  is_active BOOLEAN DEFAULT TRUE,
  subscription_plan VARCHAR(50),
  subscription_status VARCHAR(50),
  max_users INT,
  max_rooms INT,

  -- Identificação técnica 
  slug VARCHAR(100) UNIQUE NOT NULL,

  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);