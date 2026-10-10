import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  verifiedPostgresSslOptions,
  withVerifiedPostgresSsl,
} from "./postgres-connection.mjs";

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

test("keeps certificate verification enabled and accepts a configured CA", () => {
  const ca = "-----BEGIN CERTIFICATE-----\nconfigured-ca\n-----END CERTIFICATE-----";
  assert.deepEqual(
    verifiedPostgresSslOptions("postgresql://db.example/postgres?sslmode=disable", {
      SUPABASE_DB_SSL_CA: ca,
    }),
    { rejectUnauthorized: true, ca },
  );
});

test("loads the root certificate referenced by the connection URL", () => {
  const directory = mkdtempSync(join(tmpdir(), "lumen-postgres-ca-"));
  const certificatePath = join(directory, "root.crt");
  const ca = "-----BEGIN CERTIFICATE-----\nurl-ca\n-----END CERTIFICATE-----";
  writeFileSync(certificatePath, ca);
  try {
    const url = new URL("postgresql://db.example/postgres");
    url.searchParams.set("sslmode", "verify-full");
    url.searchParams.set("sslrootcert", certificatePath);
    assert.deepEqual(verifiedPostgresSslOptions(url.toString(), {}), {
      rejectUnauthorized: true,
      ca,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});