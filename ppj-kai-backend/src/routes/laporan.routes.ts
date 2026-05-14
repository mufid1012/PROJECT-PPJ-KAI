import { Router } from 'express';
import { createLaporan, getLaporan } from '../controllers/laporan.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/', createLaporan);
router.get('/', getLaporan);

export default router;
