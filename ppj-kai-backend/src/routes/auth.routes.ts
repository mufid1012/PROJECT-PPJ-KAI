import { Router } from 'express';
import { login, getMe, checkNipp } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/login', login);
router.get('/check/:nipp', checkNipp);

// Protected routes
router.get('/me', requireAuth, getMe);

export default router;
