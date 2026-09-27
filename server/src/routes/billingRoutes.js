import { Router } from 'express';
import {
  getPayments,
  createPayment,
  updatePayment,
  getPayroll,
  savePayout,
  getBillingSummary,
} from '../controllers/billingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/summary', authorize('owner', 'admin'), getBillingSummary);
router.get('/payments', authorize('owner', 'admin', 'parent'), getPayments);
router.post('/payments', authorize('admin'), createPayment);
router.patch('/payments/:id', authorize('admin'), updatePayment);
router.get('/payroll', authorize('owner', 'admin'), getPayroll);
router.post('/payouts', authorize('admin'), savePayout);

export default router;
