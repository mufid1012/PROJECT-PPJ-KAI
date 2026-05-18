import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  
  // Upsert admin user FIRST (so we can link petugas to admin via managerId)
  const admin = await prisma.user.upsert({
    where: { nipp: 'ADMIN-001' },
    update: { password: hashedAdminPassword },
    create: {
      nipp: 'ADMIN-001',
      password: hashedAdminPassword,
      nama: 'Admin',
      role: 'admin',
      isActive: true,
    }
  });

  console.log('Admin created:', admin);

  // Upsert petugas user with full profile data, linked to admin via managerId
  const user = await prisma.user.upsert({
    where: { nipp: 'KAI-1234' },
    update: {
      password: hashedPassword,
      managerId: admin.id,
      jabatan: 'Track Inspector',
      division: 'DAOP 1 Jakarta',
      workArea: 'Sektor 4 (GMR-JAKK)',
      phone: '+62 812-3456-7890',
      isActive: true,
    },
    create: {
      nipp: 'KAI-1234',
      password: hashedPassword,
      nama: 'Budi Santoso',
      role: 'petugas',
      managerId: admin.id,
      jabatan: 'Track Inspector',
      division: 'DAOP 1 Jakarta',
      workArea: 'Sektor 4 (GMR-JAKK)',
      phone: '+62 812-3456-7890',
      isActive: true,
    }
  });

  console.log('Petugas created:', user);

  // Create tasks for this user (only if none exist)
  const existingTasks = await prisma.tugasPpj.count({
    where: { assignedTo: user.id }
  });

  if (existingTasks === 0) {
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
  } else {
    console.log('Tasks already exist, skipping creation');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
