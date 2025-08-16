import express from 'express';
import { adminDashboard,getTotalAmount,getTotalCanteens,getTotalItems,getTotalMenus,getTotalOrders, getOrdersWithPagination } from '../controllers/adminDashboardController';
import authenticateToken from '../middlewares/authMiddleware'; // Import the authentication middleware


const router = express.Router();

// Route to fetch admin dashboard data
router.get('/dashboard', authenticateToken,adminDashboard);
router.get('/getTotalAmount', getTotalAmount);
router.get('/getTotalCanteens', getTotalCanteens);
router.get('/getTotalItems', getTotalItems);
router.get('/getTotalMenus', getTotalMenus);
router.get('/getTotalOrders', getTotalOrders);
router.get('/getOrders', getOrdersWithPagination);

export default router;