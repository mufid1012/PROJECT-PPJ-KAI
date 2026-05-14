import { Router } from 'express';
import { getTugasPetugas, getTugasSummary, getTugasById } from '../controllers/tugas.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// All tugas routes require authentication
router.use(requireAuth);

router.get('/', getTugasPetugas);
router.get('/summary', getTugasSummary);
router.get('/:id', getTugasById);

export default router;
