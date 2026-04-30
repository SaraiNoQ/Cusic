export function validateEnv(): void {
  const criticalVars: Record<string, string | undefined> = {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  const missing: string[] = [];
  for (const [name, value] of Object.entries(criticalVars)) {
    if (!value) {
      missing.push(name);
    }
  }

  if (
    process.env.JWT_ACCESS_SECRET === 'replace-me-access' ||
    process.env.JWT_REFRESH_SECRET === 'replace-me-refresh'
  ) {
    const msg =
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not use the default placeholder values. ' +
      'Set strong, unique secrets before running in production.';
    if (process.env.NODE_ENV === 'production') {
      console.error(`FATAL: ${msg}`);
      process.exit(1);
    }
    console.warn(`WARNING: ${msg}`);
  }

  if (missing.length > 0) {
    console.error(
      `FATAL: Missing required environment variables: ${missing.join(', ')}`,
    );
    process.exit(1);
  }

  const smtpVars: Record<string, string | undefined> = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  };
  const missingSmtp: string[] = [];
  for (const [name, value] of Object.entries(smtpVars)) {
    if (!value) {
      missingSmtp.push(name);
    }
  }
  if (missingSmtp.length > 0) {
    console.warn(
      `WARNING: Missing SMTP environment variables: ${missingSmtp.join(', ')}. ` +
        'Email functionality will not work.',
    );
  }
}
