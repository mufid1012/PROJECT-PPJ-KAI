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

  // Upsert QC A user
  const qcUserA = await prisma.user.upsert({
    where: { nipp: 'QC-001' },
    update: {
      password: hashedPassword,
      jabatan: 'Quality Control',
      division: 'DAOP 6 Yogyakarta',
      workArea: 'JR 6.1 Jenar, JR 6.2 Wojo, JR 6.3 Wates, JR 6.4 Yogyakarta',
      phone: '+62 812-9876-5432',
      isActive: true,
    },
    create: {
      nipp: 'QC-001',
      password: hashedPassword,
      nama: 'QC A',
      role: 'qc',
      jabatan: 'Quality Control',
      division: 'DAOP 6 Yogyakarta',
      workArea: 'JR 6.1 Jenar, JR 6.2 Wojo, JR 6.3 Wates, JR 6.4 Yogyakarta',
      phone: '+62 812-9876-5432',
      isActive: true,
    }
  });

  console.log('QC A user created:', qcUserA);

  // Upsert QC B user
  const qcUserB = await prisma.user.upsert({
    where: { nipp: 'QC-002' },
    update: {
      password: hashedPassword,
      jabatan: 'Quality Control',
      division: 'DAOP 6 Yogyakarta',
      workArea: 'JR 6.5 Brambanan, JR 6.6 Klaten, JR 6.7 Delanggu, JR 6.8 Solobalapan',
      phone: '+62 812-9876-5433',
      isActive: true,
    },
    create: {
      nipp: 'QC-002',
      password: hashedPassword,
      nama: 'QC B',
      role: 'qc',
      jabatan: 'Quality Control',
      division: 'DAOP 6 Yogyakarta',
      workArea: 'JR 6.5 Brambanan, JR 6.6 Klaten, JR 6.7 Delanggu, JR 6.8 Solobalapan',
      phone: '+62 812-9876-5433',
      isActive: true,
    }
  });

  console.log('QC B user created:', qcUserB);

  // Upsert QC C user
  const qcUserC = await prisma.user.upsert({
    where: { nipp: 'QC-003' },
    update: {
      password: hashedPassword,
      jabatan: 'Quality Control',
      division: 'DAOP 6 Yogyakarta',
      workArea: 'JR 6.9 Wonogiri, JR 6.10 Sumberlawang, JR 6.11 Palur, JR 6.12 Sragen, JR 6.13 Palur',
      phone: '+62 812-9876-5434',
      isActive: true,
    },
    create: {
      nipp: 'QC-003',
      password: hashedPassword,
      nama: 'QC C',
      role: 'qc',
      jabatan: 'Quality Control',
      division: 'DAOP 6 Yogyakarta',
      workArea: 'JR 6.9 Wonogiri, JR 6.10 Sumberlawang, JR 6.11 Palur, JR 6.12 Sragen, JR 6.13 Palur',
      phone: '+62 812-9876-5434',
      isActive: true,
    }
  });

  console.log('QC C user created:', qcUserC);

  // Create tasks for this user (only if they don't exist individually)
  const taskList = [
    {
      jalur: 'JR 6.1 Jenar - JR 6.2 Wojo',
      startPointName: 'Jenar',
      endPointName: 'Wojo',
      startPointLat: -7.8122,
      startPointLong: 109.9882,
      endPointLat: -7.8228,
      endPointLong: 110.0528,
      status: 'pending',
    },
    {
      jalur: 'JR 6.3 Wates - JR 6.4 Yogyakarta',
      startPointName: 'Wates',
      endPointName: 'Yogyakarta',
      startPointLat: -7.8596,
      startPointLong: 110.1594,
      endPointLat: -7.7890,
      endPointLong: 110.3636,
      status: 'in_progress',
    },
    {
      jalur: 'JR 6.5 Brambanan - JR 6.6 Klaten',
      startPointName: 'Brambanan',
      endPointName: 'Klaten',
      startPointLat: -7.7533,
      startPointLong: 110.4908,
      endPointLat: -7.7262,
      endPointLong: 110.6033,
      status: 'pending',
    },
    {
      jalur: 'JR 6.9 Wonogiri - JR 6.11 Palur',
      startPointName: 'Wonogiri',
      endPointName: 'Palur',
      startPointLat: -7.8105,
      startPointLong: 110.9254,
      endPointLat: -7.5614,
      endPointLong: 110.8606,
      status: 'pending',
    }
  ];

  for (const t of taskList) {
    const exists = await prisma.tugasPpj.findFirst({ where: { jalur: t.jalur } });
    if (!exists) {
      const created = await prisma.tugasPpj.create({
        data: {
          ...t,
          tanggal: new Date(),
          assignedTo: user.id
        }
      });
      console.log('Task created:', created.jalur);
    } else {
      console.log('Task already exists:', t.jalur);
    }
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
