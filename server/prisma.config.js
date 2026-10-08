import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Migrations run over the direct (session) connection; the app itself
// connects through Supabase's pooler using DATABASE_URL (see src/config/db.js).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node src/seed.js' },
  datasource: { url: env('DIRECT_URL') },
});
