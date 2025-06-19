import { Router } from 'express';
import { createMenuWithItems,getAllMenus,getMenusForNextTwoDaysGroupedByDateAndConfiguration,getMenuById,getMenusByCanteen, getMenuByIdforwhatsapp,updateMenuWithItems } from '../controllers/menuController';
import authenticateToken from '../middlewares/authMiddleware';

const router = Router();

// Create a menu with items
router.post('/createMenuWithItems', authenticateToken, createMenuWithItems);

router.post('/updateMenuWithItems/:menuId', authenticateToken, updateMenuWithItems);


router.get('/getAllMenus', authenticateToken, getAllMenus);

router.get('/getMenusForNextTwoDaysGroupedByDateAndConfiguration', authenticateToken, getMenusForNextTwoDaysGroupedByDateAndConfiguration);

router.get('/getMenuById', authenticateToken, getMenuById);

router.get('/getMenuByIdforwhatsapp',  getMenuByIdforwhatsapp);


router.get('/getMenusByCanteen',  getMenusByCanteen);



export default router;