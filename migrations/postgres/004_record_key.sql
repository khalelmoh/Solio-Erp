-- Key fingerprints identify configuration mistakes without storing a plaintext key.
CREATE TABLE pg_record_key(id boolean PRIMARY KEY CHECK(id),sha256 text NOT NULL CHECK(length(sha256)=64));
REVOKE ALL ON pg_record_key FROM PUBLIC;
GRANT SELECT ON pg_record_key TO erp_backend;
