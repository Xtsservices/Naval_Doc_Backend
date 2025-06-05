import { Router } from 'express';
import { createMenuWithItems,getAllMenus,getMenusForNextTwoDaysGroupedByDateAndConfiguration,getMenuById,getMenusByCanteen } from '../controllers/menuController';
import authenticateToken from '../middlewares/authMiddleware';

const router = Router();

// Create a menu with items
router.post('/createMenuWithItems', authenticateToken, createMenuWithItems);

router.get('/getAllMenus', authenticateToken, getAllMenus);

router.get('/getMenusForNextTwoDaysGroupedByDateAndConfiguration', authenticateToken, getMenusForNextTwoDaysGroupedByDateAndConfiguration);

router.get('/getMenuById', authenticateToken, getMenuById);

router.get('/getMenusByCanteen',  getMenusByCanteen);



export default router;