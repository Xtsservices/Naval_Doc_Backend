import { Router } from 'express';
import { getAllCanteens, getAllUsers,  } from '../controllers/userController';
import authenticateToken from '../middlewares/authMiddleware'; // Import the authentication middleware

const router = Router();

router.get('/getAllCanteens',authenticateToken, getAllCanteens);
router.get('/getAllUsers',authenticateToken, getAllUsers);


export default router;