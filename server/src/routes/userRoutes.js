import { Router } from 'express';
import {
  createUser,
  getUsers,
  getUser,
  updateUser,
  toggleUser,
  resetUserPassword,
  getBranchTherapists,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/therapists', authorize('owner', 'admin', 'therapist', 'teacher'), getBranchTherapists);
router.post('/', authorize('owner', 'admin'), createUser);
router.get('/', authorize('owner', 'admin'), getUsers);
router.get('/:id', authorize('owner', 'admin'), getUser);
router.put('/:id', authorize('owner', 'admin'), updateUser);
router.patch('/:id/toggle', authorize('owner', 'admin'), toggleUser);
router.patch('/:id/password', authorize('owner', 'admin'), resetUserPassword);

export default router;
