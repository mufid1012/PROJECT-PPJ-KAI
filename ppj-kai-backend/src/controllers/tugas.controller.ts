import { Request, Response } from 'express';
import prisma from '../config/database';

export const getTugasPetugas = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const tugas = await prisma.tugasPpj.findMany({
      where: { assignedTo: userId },
      orderBy: { tanggal: 'desc' },
      include: {
        tracking: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return res.json({ success: true, data: tugas });
  } catch (error) {
    console.error('Get Tugas error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getTugasById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const tugas = await prisma.tugasPpj.findFirst({
      where: { id: parseInt(id), assignedTo: userId },
      include: {
        tracking: {
          orderBy: { createdAt: 'desc' },
          include: {
            laporan: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!tugas) {
      return res.status(404).json({ success: false, message: 'Tugas not found' });
    }

    return res.json({ success: true, data: tugas });
  } catch (error) {
    console.error('Get Tugas by ID error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getTugasSummary = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get all tasks for this user
    const tugas = await prisma.tugasPpj.findMany({
      where: {
        assignedTo: userId,
      },
      select: {
        status: true,
      }
    });

    // Mocking emergency reports count for the prototype
    const emergencyReports = await prisma.laporan.count({
      where: {
        tracking: {
          tugas: {
            assignedTo: userId
          }
        },
        jenisTemuan: 'emergency'
      }
    });

    const summary = {
      totalTasks: tugas.length,
      completed: tugas.filter(t => t.status === 'completed').length,
      inProgress: tugas.filter(t => t.status === 'in_progress').length,
      pending: tugas.filter(t => t.status === 'pending').length,
      emergencyReports: emergencyReports || 0
    };

    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Get Summary error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
