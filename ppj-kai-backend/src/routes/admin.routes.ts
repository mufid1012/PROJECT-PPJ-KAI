import { Router } from 'express';
import { requireAuth, requireAdmin, requireAdminOrQC } from '../middleware/auth.middleware';
import { getStats, getAllPetugas, getAvailablePetugas, addPetugasToManager, removePetugasFromManager, getAllTugas, createTugas, deleteTugas, getAllEmergency, getActiveTrackingAll } from '../controllers/admin.controller';

const router = Router();

// Stats and monitoring pages are accessible by both Admin and QC
router.get('/stats', requireAuth, requireAdminOrQC, getStats);
router.get('/petugas', requireAuth, requireAdminOrQC, getAllPetugas);
router.get('/tugas', requireAuth, requireAdminOrQC, getAllTugas);
router.get('/emergency', requireAuth, requireAdminOrQC, getAllEmergency);
router.get('/tracking/active', requireAuth, requireAdminOrQC, getActiveTrackingAll);

// Management and write operations are restricted to Admins only
router.get('/petugas/available', requireAuth, requireAdmin, getAvailablePetugas);
router.post('/petugas/add', requireAuth, requireAdmin, addPetugasToManager);
router.post('/petugas/remove', requireAuth, requireAdmin, removePetugasFromManager);
router.post('/tugas', requireAuth, requireAdmin, createTugas);
router.delete('/tugas/:id', requireAuth, requireAdmin, deleteTugas);

export default router;

