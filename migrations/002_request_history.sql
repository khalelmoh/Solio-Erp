ALTER TABLE requests ADD COLUMN supersedes_id INTEGER REFERENCES requests(id);
