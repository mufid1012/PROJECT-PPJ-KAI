import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { getStats, getAllPetugas, getAllTugas, createTugas, deleteTugas, getAllEmergency } from '../controllers/admin.controller';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', getStats);
router.get('/petugas', getAllPetugas);
router.get('/tugas', getAllTugas);
router.post('/tugas', createTugas);
router.delete('/tugas/:id', deleteTugas);
router.get('/emergency', getAllEmergency);

export default router;
