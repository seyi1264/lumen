import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProductionDatabaseConfigured,
  isProductionRuntime,
} from "./runtime-guards.ts";

test("runtime guards", async (t) => {
  await t.test("keeps the PGLite fallback local-only", () => {
    assert.doesNotThrow(() =>
      assertProductionDatabaseConfigured(undefined, { production: false }),
    );
  });

  await t.test("requires a valid Postgres URL in serverless production", () => {
    assert.equal(isProductionRuntime({ VERCEL: "1" }), true);
    assert.throws(
      () => assertProductionDatabaseConfigured(undefined, { production: true }),
      /Production requires a real Postgres connection string/,
    );
    assert.throws(
      () => assertProductionDatabaseConfigured("file:///tmp/db", { production: true }),
      /Production requires a real Postgres connection string/,
    );
    assert.doesNotThrow(() =>
      assertProductionDatabaseConfigured("postgresql://db.example/app", { production: true }),
    );
  });
});