import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  // Upsert user
  const user = await prisma.user.upsert({
    where: { nipp: 'KAI-1234' },
    update: { password: hashedPassword },
    create: {
      nipp: 'KAI-1234',
      password: hashedPassword,
      nama: 'Budi Santoso',
      role: 'petugas'
    }
  });

  console.log('User created:', user);

  // Create tasks for this user
  const tugas1 = await prisma.tugasPpj.create({
    data: {
      jalur: 'Jalur Utama Jakarta-Bandung',
      tanggal: new Date(),
      status: 'pending',
      startPointName: 'Stasiun Gambir',
      endPointName: 'Stasiun Bandung',
      startPointLat: -6.1766,
      startPointLong: 106.8306,
      endPointLat: -6.9147,
      endPointLong: 107.6022,
      assignedTo: user.id
    }
  });

  const tugas2 = await prisma.tugasPpj.create({
    data: {
      jalur: 'Wesel Stasiun Gambir',
      tanggal: new Date(),
      status: 'completed',
      startPointName: 'KM 0.0',
      endPointName: 'KM 2.5',
      startPointLat: -6.1766,
      startPointLong: 106.8306,
      endPointLat: -6.1800,
      endPointLong: 106.8350,
      assignedTo: user.id
    }
  });

  console.log('Tasks created:', tugas1, tugas2);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
