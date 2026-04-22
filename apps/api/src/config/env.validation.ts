type EnvironmentRecord = Record<string, string | undefined>;

export function validateEnvironment(config: EnvironmentRecord): EnvironmentRecord {
  const requiredKeys = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missingKeys = requiredKeys.filter((key) => {
    const value = config[key];
    return value === undefined || value.trim() === '';
  });

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
  }

  if (config.PORT !== undefined && Number.isNaN(Number(config.PORT))) {
    throw new Error('PORT must be numeric when provided.');
  }

  return config;
}

