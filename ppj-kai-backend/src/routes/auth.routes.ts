import { Router } from 'express';
import { login, register, getMe, checkNipp, updateProfile } from '../controllers/auth.controller';

import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/register', register);

router.get('/check/:nipp', checkNipp);

// Protected routes
router.get('/me', requireAuth, getMe);
router.patch('/profile', requireAuth, updateProfile);

export default router;
