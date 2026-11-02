-- Defense in depth for privileged backend bugs; no application bypass switch.
CREATE FUNCTION guard_posted_period() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW.state='posted' AND EXISTS(SELECT 1 FROM periods WHERE state='closed' AND start_date<=NEW.date AND end_date>=NEW.date) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Accounting period is locked';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER journal_period_guard BEFORE UPDATE OF state ON journals FOR EACH ROW EXECUTE FUNCTION guard_posted_period();
CREATE FUNCTION guard_source_dimension() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM funding_sources WHERE id=NEW.source_id AND project_id=NEW.project_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Project funding dimension mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER journal_dimension_guard BEFORE INSERT OR UPDATE ON journal_lines FOR EACH ROW EXECUTE FUNCTION guard_source_dimension();
CREATE FUNCTION guard_operation_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Immutable operation receipt'; END $$;
CREATE TRIGGER immutable_operation_receipt BEFORE UPDATE OR DELETE ON operations FOR EACH ROW EXECUTE FUNCTION guard_operation_receipt();
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA :SCHEMA: FROM PUBLIC;
