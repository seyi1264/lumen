import { readFileSync } from "node:fs";

const sslConnectionParameters = [
  "ssl",
  "sslmode",
  "sslca",
  "sslcert",
  "sslkey",
  "sslpassword",
  "sslrootcert",
];

/**
 * Keep hostname and chain verification enabled. Set SUPABASE_DB_SSL_CA to the
 * project's downloaded PEM when its CA is not in Node's default trust store;
 * `sslrootcert` paths in the URL are also supported.
 * @param {string} connectionString
 * @param {NodeJS.ProcessEnv} [environment]
 */
export function verifiedPostgresSslOptions(
  connectionString,
  environment = process.env,
) {
  const url = new URL(connectionString);
  const caPath = url.searchParams.get("sslrootcert");
  const ca = environment.SUPABASE_DB_SSL_CA?.trim() ||
    (caPath ? readFileSync(caPath, "utf8") : undefined);
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}

/** @param {string} connectionString */
export function withVerifiedPostgresSsl(connectionString) {
  const url = new URL(connectionString);
  for (const parameter of sslConnectionParameters) {
    url.searchParams.delete(parameter);
  }
  return url.toString();
}