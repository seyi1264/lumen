import assert from "node:assert/strict";
import { test } from "node:test";
import { withVerifiedPostgresSsl } from "./postgres-connection.mjs";

test("removes connection-string SSL overrides while preserving connection settings", () => {
  const normalized = new URL(
    withVerifiedPostgresSsl(
      "postgresql://postgres:secret@db.example:5432/postgres?sslmode=disable&sslrootcert=custom.pem&application_name=lumen",
    ),
  );

  assert.equal(normalized.username, "postgres");
  assert.equal(normalized.password, "secret");
  assert.equal(normalized.pathname, "/postgres");
  assert.equal(normalized.searchParams.get("application_name"), "lumen");
  for (const parameter of ["ssl", "sslmode", "sslca", "sslcert", "sslkey", "sslpassword", "sslrootcert"]) {
    assert.equal(normalized.searchParams.has(parameter), false);
  }
});