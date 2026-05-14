import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create an Admin user
  const admin = await prisma.user.upsert({
    where: { nipp: 'ADMIN-001' },
    update: {},
    create: {
      nipp: 'ADMIN-001',
      nama: 'Admin KAI',
      password: hashedPassword,
      role: 'admin',
    },
  });

  // Create a Petugas user
  const petugas = await prisma.user.upsert({
    where: { nipp: 'KAI-9921' },
    update: {},
    create: {
      nipp: 'KAI-9921',
      nama: 'Rahmat Hidayat',
      password: hashedPassword,
      role: 'petugas',
    },
  });

  // Create a Sample Task for Petugas
  await prisma.tugasPpj.create({
    data: {
      jalur: 'Jalur Inspeksi DAOP 1 Jakarta - Bogor',
      tanggal: new Date(),
      startPointLat: -6.175110,
      startPointLong: 106.827153,
      endPointLat: -6.597147,
      endPointLong: 106.793266,
      startPointName: 'Stasiun Gambir',
      endPointName: 'Stasiun Bogor',
      assignedTo: petugas.id,
      status: 'pending'
    }
  });

  console.log({ admin, petugas });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
