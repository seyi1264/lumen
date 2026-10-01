const sslConnectionParameters = [
  "ssl",
  "sslmode",
  "sslca",
  "sslcert",
  "sslkey",
  "sslpassword",
  "sslrootcert",
];

/** @param {string} connectionString */
export function withVerifiedPostgresSsl(connectionString) {
  const url = new URL(connectionString);
  for (const parameter of sslConnectionParameters) {
    url.searchParams.delete(parameter);
  }
  return url.toString();
}