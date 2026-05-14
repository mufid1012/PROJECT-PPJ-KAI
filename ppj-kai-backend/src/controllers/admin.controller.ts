import { Request, Response } from 'express';
import prisma from '../config/database';

// GET /admin/stats
export const getStats = async (req: Request, res: Response) => {
  try {
    const [totalPetugas, tugasAktif, tugasSelesai, laporanDarurat] = await Promise.all([
      prisma.user.count({ where: { role: 'petugas' } }),
      prisma.tugasPpj.count({ where: { status: { in: ['pending', 'in_progress'] } } }),
      prisma.tugasPpj.count({ where: { status: 'completed' } }),
      prisma.laporan.count({ where: { jenisTemuan: { in: ['emergency', 'berat'] } } }),
    ]);
    return res.json({ success: true, data: { totalPetugas, tugasAktif, tugasSelesai, laporanDarurat } });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /admin/petugas
export const getAllPetugas = async (req: Request, res: Response) => {
  try {
    const petugas = await prisma.user.findMany({
      where: { role: 'petugas' },
      select: {
        id: true, nipp: true, nama: true, foto: true,
        tugasPpj: {
          where: { status: { in: ['pending', 'in_progress'] } },
          select: { id: true, jalur: true, status: true }
        }
      },
      orderBy: { nama: 'asc' },
    });
    return res.json({ success: true, data: petugas });
  } catch (error) {
    console.error('Get petugas error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /admin/tugas
export const getAllTugas = async (req: Request, res: Response) => {
  try {
    const tugas = await prisma.tugasPpj.findMany({
      include: {
        user: { select: { id: true, nama: true, nipp: true } },
        tracking: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, startTime: true, endTime: true, durasi: true, status: true, startLat: true, startLong: true, endLat: true, endLong: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: tugas });
  } catch (error) {
    console.error('Get all tugas error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /admin/tugas
export const createTugas = async (req: Request, res: Response) => {
  try {
    const { jalur, tanggal, startPointLat, startPointLong, endPointLat, endPointLong, startPointName, endPointName, assignedTo } = req.body;

    if (!jalur || !tanggal || !startPointLat || !startPointLong || !endPointLat || !endPointLong || !assignedTo) {
      return res.status(400).json({ success: false, message: 'Field wajib tidak lengkap' });
    }

    const tugas = await prisma.tugasPpj.create({
      data: {
        jalur,
        tanggal: new Date(tanggal),
        startPointLat: parseFloat(startPointLat),
        startPointLong: parseFloat(startPointLong),
        endPointLat: parseFloat(endPointLat),
        endPointLong: parseFloat(endPointLong),
        startPointName: startPointName || '',
        endPointName: endPointName || '',
        assignedTo: parseInt(assignedTo),
        status: 'pending',
      },
      include: { user: { select: { nama: true, nipp: true } } }
    });

    return res.status(201).json({ success: true, data: tugas });
  } catch (error) {
    console.error('Create tugas error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /admin/tugas/:id
export const deleteTugas = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.tugasPpj.delete({ where: { id: parseInt(id) } });
    return res.json({ success: true, message: 'Tugas dihapus' });
  } catch (error) {
    console.error('Delete tugas error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /admin/emergency
export const getAllEmergency = async (req: Request, res: Response) => {
  try {
    const laporan = await prisma.laporan.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tracking: {
          include: {
            tugas: {
              include: { user: { select: { nama: true, nipp: true } } }
            }
          }
        }
      }
    });
    return res.json({ success: true, data: laporan });
  } catch (error) {
    console.error('Get emergency error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
