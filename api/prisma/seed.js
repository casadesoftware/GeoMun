const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@geomun.local';
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';
  const name = process.env.ADMIN_NAME || 'Administrador';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[Seed] Admin ya existe: ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, password: hash, name, role: 'ADMIN' },
  });
  console.log(`[Seed] Admin creado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
