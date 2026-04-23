export default () => ({
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  agentClientId: process.env.AGENT_CLIENT_ID,
  agentClientSecret: process.env.AGENT_CLIENT_SECRET,
  agentClientName: process.env.AGENT_CLIENT_NAME
});
