import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { generateToken } from '../utils/jwt';

export const login = async (req: Request, res: Response) => {
  try {
    const { nipp, password } = req.body;

    if (!nipp || !password) {
      return res.status(400).json({ success: false, message: 'NIPP and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { nipp },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.role);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        nipp: user.nipp,
        nama: user.nama,
        role: user.role,
        foto: user.foto,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    // req.user is set by the auth middleware
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nipp: true,
        nama: true,
        role: true,
        foto: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error('Get Me error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const checkNipp = async (req: Request, res: Response) => {
  try {
    const { nipp } = req.params;
    if (!nipp) {
      return res.status(400).json({ success: false, message: 'NIPP is required' });
    }

    const user = await prisma.user.findUnique({
      where: { nipp },
      select: { nama: true, role: true }
    });

    if (user) {
      return res.json({ success: true, exists: true, user });
    } else {
      return res.json({ success: true, exists: false });
    }
  } catch (error) {
    console.error('Check NIPP error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
