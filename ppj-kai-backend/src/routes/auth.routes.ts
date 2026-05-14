import { Router } from 'express';
import { login, register, getMe, checkNipp } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/register', register);
router.get('/check/:nipp', checkNipp);

// Protected routes
router.get('/me', requireAuth, getMe);

export default router;
