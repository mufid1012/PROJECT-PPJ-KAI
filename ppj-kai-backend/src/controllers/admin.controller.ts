import { Request, Response } from 'express';
import prisma from '../config/database';

// Extend Request type to include user (set by auth middleware)
interface AuthRequest extends Request {
  user?: { id: number; role: string };
}

// GET /admin/stats
export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    if (user.role === 'admin') {
      const [totalPetugas, tugasAktif, tugasSelesai, laporanDarurat] = await Promise.all([
        prisma.user.count({ where: { role: 'petugas', managerId: userId } }),
        prisma.tugasPpj.count({ where: { status: { in: ['pending', 'in_progress'] }, user: { managerId: userId } } }),
        prisma.tugasPpj.count({ where: { status: 'completed', user: { managerId: userId } } }),
        prisma.laporan.count({ where: { jenisTemuan: { in: ['emergency', 'berat'] }, tracking: { tugas: { user: { managerId: userId } } } } }),
      ]);
      return res.json({ success: true, data: { totalPetugas, tugasAktif, tugasSelesai, laporanDarurat } });
    } else if (user.role === 'qc') {
      const regions = user.workArea ? user.workArea.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (regions.length === 0) {
        return res.json({ success: true, data: { totalPetugas: 0, tugasAktif: 0, tugasSelesai: 0, laporanDarurat: 0 } });
      }

      const regionFilter = {
        OR: regions.map(r => ({ jalur: { contains: r } }))
      };

      const [totalPetugas, tugasAktif, tugasSelesai, laporanDarurat] = await Promise.all([
        prisma.user.count({
          where: {
            role: 'petugas',
            OR: [
              { tugasPpj: { some: regionFilter } },
              { OR: regions.map(r => ({ workArea: { contains: r } })) }
            ]
          }
        }),
        prisma.tugasPpj.count({
          where: {
            status: { in: ['pending', 'in_progress'] },
            ...regionFilter
          }
        }),
        prisma.tugasPpj.count({
          where: {
            status: 'completed',
            ...regionFilter
          }
        }),
        prisma.laporan.count({
          where: {
            jenisTemuan: { in: ['emergency', 'berat'] },
            tracking: { tugas: regionFilter }
          }
        }),
      ]);
      return res.json({ success: true, data: { totalPetugas, tugasAktif, tugasSelesai, laporanDarurat } });
    } else {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /admin/petugas
export const getAllPetugas = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    if (user.role === 'admin') {
      const petugas = await prisma.user.findMany({
        where: { role: 'petugas', managerId: userId },
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
    } else if (user.role === 'qc') {
      const regions = user.workArea ? user.workArea.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (regions.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const regionFilter = {
        OR: regions.map(r => ({ jalur: { contains: r } }))
      };

      const petugas = await prisma.user.findMany({
        where: {
          role: 'petugas',
          OR: [
            { tugasPpj: { some: regionFilter } },
            { OR: regions.map(r => ({ workArea: { contains: r } })) }
          ]
        },
        select: {
          id: true, nipp: true, nama: true, foto: true,
          tugasPpj: {
            where: {
              status: { in: ['pending', 'in_progress'] },
              ...regionFilter
            },
            select: { id: true, jalur: true, status: true }
          }
        },
        orderBy: { nama: 'asc' },
      });
      return res.json({ success: true, data: petugas });
    } else {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
  } catch (error) {
    console.error('Get petugas error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /admin/petugas/available
export const getAvailablePetugas = async (req: AuthRequest, res: Response) => {
  try {
    const petugas = await prisma.user.findMany({
      where: { role: 'petugas', managerId: null },
      select: { id: true, nipp: true, nama: true },
      orderBy: { nama: 'asc' }
    });
    return res.json({ success: true, data: petugas });
  } catch (error) {
    console.error('Get available petugas error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /admin/petugas/add
export const addPetugasToManager = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { nipps } = req.body; // Expecting an array of NIPPs
    
    if (!nipps || !Array.isArray(nipps) || nipps.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar NIPP wajib diisi' });
    }

    // Update all matching petugas that are currently available
    await prisma.user.updateMany({
      where: { 
        nipp: { in: nipps },
        role: 'petugas',
        managerId: null
      },
      data: { managerId: adminId }
    });

    return res.json({ success: true, message: 'Petugas berhasil ditambahkan ke daftar kelola Anda' });
  } catch (error) {
    console.error('Add petugas error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /admin/petugas/remove
export const removePetugasFromManager = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { id } = req.body;
    
    if (!id) return res.status(400).json({ success: false, message: 'ID Petugas wajib diisi' });

    // Ensure the petugas belongs to this manager
    const petugas = await prisma.user.findFirst({
      where: { id: parseInt(id), managerId: adminId }
    });
    
    if (!petugas) return res.status(404).json({ success: false, message: 'Petugas tidak ditemukan dalam daftar Anda' });

    await prisma.user.update({
      where: { id: petugas.id },
      data: { managerId: null }
    });

    return res.json({ success: true, message: 'Petugas berhasil dihapus dari daftar kelola Anda' });
  } catch (error) {
    console.error('Remove petugas error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /admin/tugas
export const getAllTugas = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    let whereClause: any = {};
    if (user.role === 'admin') {
      whereClause = { user: { managerId: userId } };
    } else if (user.role === 'qc') {
      const regions = user.workArea ? user.workArea.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (regions.length === 0) {
        return res.json({ success: true, data: [] });
      }
      whereClause = {
        OR: regions.map(r => ({ jalur: { contains: r } }))
      };
    } else {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const tugas = await prisma.tugasPpj.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, nama: true, nipp: true } },
        tracking: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { laporan: true }
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
export const createTugas = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { jalur, tanggal, startPointLat, startPointLong, endPointLat, endPointLong, startPointName, endPointName, assignedTo, jamMulai, jamBerakhir } = req.body;

    if (!jalur || !tanggal || !startPointLat || !startPointLong || !endPointLat || !endPointLong || !assignedTo) {
      return res.status(400).json({ success: false, message: 'Field wajib tidak lengkap' });
    }

    // Ensure the assigned petugas actually belongs to this manager
    const petugasCheck = await prisma.user.findFirst({
      where: { id: parseInt(assignedTo), managerId: adminId }
    });
    
    if (!petugasCheck) return res.status(403).json({ success: false, message: 'Petugas tidak ditemukan dalam daftar kelola Anda' });

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
        jamMulai: jamMulai || null,
        jamBerakhir: jamBerakhir || null,
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
export const deleteTugas = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;
    
    // Check if task belongs to a managed user
    const tugas = await prisma.tugasPpj.findFirst({
      where: { id: parseInt(id as string), user: { managerId: adminId } }
    });
    
    if (!tugas) return res.status(403).json({ success: false, message: 'Tugas tidak ditemukan atau tidak diizinkan' });

    await prisma.tugasPpj.delete({ where: { id: parseInt(id as string) } });
    return res.json({ success: true, message: 'Tugas dihapus' });
  } catch (error) {
    console.error('Delete tugas error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /admin/emergency
export const getAllEmergency = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    let whereClause: any = {};
    if (user.role === 'admin') {
      whereClause = { tracking: { tugas: { user: { managerId: userId } } } };
    } else if (user.role === 'qc') {
      const regions = user.workArea ? user.workArea.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (regions.length === 0) {
        return res.json({ success: true, data: [] });
      }
      whereClause = {
        tracking: {
          tugas: {
            OR: regions.map(r => ({ jalur: { contains: r } }))
          }
        }
      };
    } else {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const laporan = await prisma.laporan.findMany({
      where: whereClause,
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

// GET /admin/tracking/active — all currently active tracking sessions
export const getActiveTrackingAll = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    let whereClause: any = { status: 'started' };
    if (user.role === 'admin') {
      whereClause = {
        status: 'started',
        tugas: { user: { managerId: userId } }
      };
    } else if (user.role === 'qc') {
      const regions = user.workArea ? user.workArea.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (regions.length === 0) {
        return res.json({ success: true, data: [] });
      }
      whereClause = {
        status: 'started',
        tugas: {
          OR: regions.map(r => ({ jalur: { contains: r } }))
        }
      };
    } else {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const activeTracking = await prisma.tracking.findMany({
      where: whereClause,
      include: {
        tugas: {
          include: {
            user: { select: { id: true, nama: true, nipp: true, foto: true } }
          }
        }
      },
      orderBy: { startTime: 'desc' },
    });

    const data = activeTracking.map(t => ({
      trackingId: t.id,
      startTime: t.startTime,
      startLat: t.startLat,
      startLong: t.startLong,
      lastLat: t.endLat ?? t.startLat,
      lastLong: t.endLong ?? t.startLong,
      tugas: {
        id: t.tugas.id,
        jalur: t.tugas.jalur,
        startPointName: t.tugas.startPointName,
        endPointName: t.tugas.endPointName,
        startPointLat: t.tugas.startPointLat,
        startPointLong: t.tugas.startPointLong,
        endPointLat: t.tugas.endPointLat,
        endPointLong: t.tugas.endPointLong,
      },
      petugas: t.tugas.user,
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Get active tracking error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
