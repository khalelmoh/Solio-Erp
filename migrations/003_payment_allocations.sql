CREATE TABLE payment_allocations(id INTEGER PRIMARY KEY, payment_id INTEGER NOT NULL REFERENCES payments(id), bill_line_id INTEGER NOT NULL REFERENCES bill_lines(id), amount INTEGER NOT NULL CHECK(amount>0));
ALTER TABLE reconciliations ADD COLUMN line_watermark INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER payment_allocation_no_update BEFORE UPDATE ON payment_allocations BEGIN SELECT RAISE(ABORT,'Immutable payment allocation'); END;
CREATE TRIGGER payment_allocation_no_delete BEFORE DELETE ON payment_allocations BEGIN SELECT RAISE(ABORT,'Immutable payment allocation'); END;
