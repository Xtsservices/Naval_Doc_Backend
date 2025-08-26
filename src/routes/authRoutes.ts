import express from 'express';
import { loginWithMobile,verifyOtp,resendOtp,getProfile,updateProfile,logout } from '../controllers/authController';
import authenticateToken from '../middlewares/authMiddleware';

const router = express.Router();

const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Define the login route
router.post('/login', asyncHandler(loginWithMobile));
router.post('/verifyOtp', asyncHandler(verifyOtp));

router.post('/resendOtp', asyncHandler(resendOtp));

router.get('/getProfile', authenticateToken, getProfile);

// Route to update user profile
router.put('/updateProfile', authenticateToken, updateProfile);

// Route to logout user
router.post('/logout', authenticateToken, logout);

export default router;




