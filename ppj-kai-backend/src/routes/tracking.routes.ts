import { Router } from 'express';
import { startTracking, updateTracking, stopTracking, getActiveTracking } from '../controllers/tracking.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/active/:tugasId', getActiveTracking);
router.post('/start/:tugasId', startTracking);
router.post('/update/:id', updateTracking);
router.post('/stop/:id', stopTracking);

export default router;
