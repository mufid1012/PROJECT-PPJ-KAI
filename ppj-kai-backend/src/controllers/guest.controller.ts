import { Request, Response } from 'express';
import prisma from '../config/database';

export const getMonitoringData = async (req: Request, res: Response) => {
  try {
    const [activeTracking, tasks, emergencies] = await Promise.all([
      prisma.tracking.findMany({
        where: { status: 'started' },
        include: {
          tugas: {
            include: {
              user: { select: { id: true, nama: true, nipp: true, foto: true } }
            }
          }
        },
        orderBy: { startTime: 'desc' },
      }),
      prisma.tugasPpj.findMany({
        include: {
          user: { select: { id: true, nama: true, nipp: true } }
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.laporan.findMany({
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
      })
    ]);

    const activeTrackingData = activeTracking.map(t => ({
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

    return res.json({
      success: true,
      data: {
        activeTrackings: activeTrackingData,
        tasks,
        emergencies
      }
    });
  } catch (error) {
    console.error('Guest monitoring data error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
