import { Request, Response } from 'express';
import prisma from '../config/database';

export const createLaporan = async (req: Request, res: Response) => {
  try {
    const { trackingId, jenisTemuan, deskripsi, lat, lng, fotoUrl } = req.body;

    const laporan = await prisma.laporan.create({
      data: {
        trackingId: parseInt(trackingId),
        jenisTemuan,
        deskripsi: deskripsi || '',
        foto: fotoUrl || '',
        latitude: lat || 0,
        longitude: lng || 0,
      }
    });

    return res.json({ success: true, data: laporan });
  } catch (error) {
    console.error('Create laporan error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getLaporan = async (req: Request, res: Response) => {
  try {
    const laporan = await prisma.laporan.findMany({
      include: {
        tracking: {
          include: {
            tugas: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json({ success: true, data: laporan });
  } catch (error) {
    console.error('Get laporan error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
