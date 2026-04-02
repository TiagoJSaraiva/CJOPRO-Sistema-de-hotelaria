-- Atualiza updated_at apenas quando houver mudança real de dados (ignora o proprio updated_at)
CREATE OR REPLACE FUNCTION set_updated_at_if_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF to_jsonb(NEW) - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - 'updated_at' THEN
    NEW.updated_at = NOW();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_if_changed();

DROP TRIGGER IF EXISTS trg_hotels_set_updated_at ON hotels;
CREATE TRIGGER trg_hotels_set_updated_at
BEFORE UPDATE ON hotels
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_if_changed();
