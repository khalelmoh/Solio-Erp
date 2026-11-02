-- User-selected single-currency policy. Preserve historical rows and block new FX evidence.
CREATE TRIGGER usd_currency_definition BEFORE INSERT ON currency_definitions
WHEN NEW.code<>'USD' OR NEW.scale<>2
BEGIN SELECT RAISE(ABORT,'This ERP supports USD only at scale 2'); END;
CREATE TRIGGER usd_cash_account BEFORE INSERT ON account_currencies
WHEN NEW.currency<>'USD'
BEGIN SELECT RAISE(ABORT,'This ERP supports USD cash accounts only'); END;
CREATE TRIGGER usd_account_currency_update BEFORE UPDATE ON account_currencies
BEGIN SELECT RAISE(ABORT,'Immutable account currency'); END;
CREATE TRIGGER usd_currency_scale_update BEFORE UPDATE ON currency_definitions
BEGIN SELECT RAISE(ABORT,'Immutable currency scale'); END;
CREATE TRIGGER usd_currency_scale_delete BEFORE DELETE ON currency_definitions
BEGIN SELECT RAISE(ABORT,'Immutable currency scale'); END;
CREATE TRIGGER usd_account_currency_delete BEFORE DELETE ON account_currencies
BEGIN SELECT RAISE(ABORT,'Immutable account currency'); END;
CREATE TRIGGER usd_exchange_rates BEFORE INSERT ON fx_rates
BEGIN SELECT RAISE(ABORT,'This ERP supports USD only; exchange rates are disabled'); END;
CREATE TRIGGER usd_foreign_documents BEFORE INSERT ON foreign_documents
BEGIN SELECT RAISE(ABORT,'This ERP supports USD only; foreign documents are disabled'); END;
CREATE TRIGGER usd_foreign_cash BEFORE INSERT ON foreign_cash_lines
BEGIN SELECT RAISE(ABORT,'This ERP supports USD cash accounts only'); END;
