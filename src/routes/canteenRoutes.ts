import { Router } from 'express';
import { createCanteen,getAllCanteens, getAllCanteensforwhatsapp,updateCanteen } from '../controllers/canteenController';
import upload from '../middlewares/multerConfig';
import authenticateToken from '../middlewares/authMiddleware'; // Import the authentication middleware

const router = Router();

// Route to create a canteen with image upload and token authentication
router.post('/createCanteen', authenticateToken, upload.single('canteenImage'), createCanteen);
router.post('/updateCanteen', authenticateToken, upload.single('canteenImage'), updateCanteen);

router.get('/getAllCanteens', authenticateToken, getAllCanteens);
router.get('/getAllCanteensforwhatsapp', getAllCanteensforwhatsapp);

export default router;