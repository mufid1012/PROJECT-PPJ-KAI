import { Router } from 'express';
import { getMonitoringData } from '../controllers/guest.controller';

const router = Router();

router.get('/monitoring', getMonitoringData);

export default router;
