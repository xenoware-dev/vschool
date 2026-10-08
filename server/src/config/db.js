import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// The app talks to Postgres through Supabase's transaction pooler (DATABASE_URL).
// `pgbouncer=true` is a Prisma hint, not a Postgres option, so it is stripped
// before handing the URL to node-postgres.
const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]pgbouncer=true/, '');

const adapter = new PrismaPg({
  connectionString,
  // Supabase requires TLS. Its pooler certificate is signed by Supabase's own CA,
  // which is not in Node's default trust store.
  // TODO: pin Supabase's CA certificate and enable verification before production.
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_SIZE) || 10,
});

const prisma = new PrismaClient({ adapter });

export const connectDB = async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  await prisma.$queryRaw`SELECT 1`;
  console.log('✅ Connected to Supabase Postgres');
};

const shutdown = async () => {
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default prisma;
