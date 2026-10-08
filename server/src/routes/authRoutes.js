import { Router } from 'express';
import { login, refresh, getMe, changePassword } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', protect, getMe);
router.put('/password', protect, changePassword);

export default router;
