import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  // Attach user to request
  (req as any).user = decoded;
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
  }

  next();
};

export const requireAdminOrQC = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user || (user.role !== 'admin' && user.role !== 'qc')) {
    return res.status(403).json({ success: false, message: 'Access denied. Admin or QC only.' });
  }

  next();
};

