import express from 'express';
import { loginWithMobile,verifyOtp,resendOtp,getProfile,updateProfile,logout ,deleteAccount} from '../controllers/authController';
import authenticateToken from '../middlewares/authMiddleware';

const router = express.Router();

const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Define the login route

router.get('/logout', authenticateToken, asyncHandler(logout));

router.post('/login', asyncHandler(loginWithMobile));
router.post('/verifyOtp', asyncHandler(verifyOtp));

router.post('/resendOtp', asyncHandler(resendOtp));

router.get('/getProfile', authenticateToken, getProfile);

// Route to update user profile
router.put('/updateProfile', authenticateToken, asyncHandler(updateProfile));

router.delete('/deleteAccount', authenticateToken, asyncHandler(deleteAccount));

// Route to logout user
// router.post('/logout', asyncHandler(logout));


export default router;




