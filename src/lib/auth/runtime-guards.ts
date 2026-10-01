type RuntimeEnvironment = {
  VERCEL?: string;
  NODE_ENV?: string;
};

export function isProductionRuntime(
  envSource: RuntimeEnvironment = process.env,
): boolean {
  return Boolean(envSource.VERCEL) || envSource.NODE_ENV === "production";
}

export function assertProductionDatabaseConfigured(
  value: string | undefined,
  options: { production?: boolean } = {},
): asserts value is string {
  const production = options.production ?? isProductionRuntime();
  if (!production) return;
  if (!value || !/^postgres(?:ql)?:\/\//i.test(value.trim())) {
    throw new Error(
      "Production requires a real Postgres connection string. Set SUPABASE_DB_URL or DATABASE_URL to a valid postgres://... URL.",
    );
  }
}