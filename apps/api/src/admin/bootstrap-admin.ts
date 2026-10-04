import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { isEmail } from 'class-validator';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { hashPassword } from './password';

async function bootstrapAdmin() {
  dotenv.config({ path: resolve(__dirname, '../../../../.env'), quiet: true });
  const email = process.env.ANKA_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const name = process.env.ANKA_BOOTSTRAP_NAME?.trim();
  const password = process.env.ANKA_BOOTSTRAP_PASSWORD;
  const connectionString = process.env.DATABASE_URL;
  if (
    !connectionString ||
    !email ||
    !isEmail(email) ||
    email.length > 254 ||
    !name ||
    name.length > 120 ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 72
  )
    throw new Error(
      'Set DATABASE_URL, ANKA_BOOTSTRAP_EMAIL, ANKA_BOOTSTRAP_NAME and ANKA_BOOTSTRAP_PASSWORD (at least 12 characters, at most 72 UTF-8 bytes)',
    );
  const passwordHash = await hashPassword(password);
  delete process.env.ANKA_BOOTSTRAP_PASSWORD;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    await prisma.admin.create({
      data: { email, name, passwordHash },
      select: { id: true },
    });
    console.log(
      'Administrator created. Existing administrators are never overwritten.',
    );
  } finally {
    await prisma.$disconnect();
  }
}
void bootstrapAdmin().catch(() => {
  console.error(
    'Administrator bootstrap failed. Check configuration, email uniqueness and database availability.',
  );
  process.exitCode = 1;
});
