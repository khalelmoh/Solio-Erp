export function requireImplementedDatabase(env=process.env){
  const provider=env.ERP_DATABASE_PROVIDER||'sqlite';
  if(!['sqlite','postgres','supabase'].includes(provider))throw Error('Unsupported database provider; refusing a silent SQLite fallback.');
  if(provider!=='sqlite'&&!env.ERP_POSTGRES_URL&&!env.ERP_POSTGRES_URL_FILE)throw Error('PostgreSQL requires ERP_POSTGRES_URL_FILE; refusing a silent SQLite fallback.');
  return provider;
}
