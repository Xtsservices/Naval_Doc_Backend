import { Router } from 'express';
import {
  getAllMenuConfigurations,
  createMenuConfiguration,
  updateMenuConfiguration,
  deleteMenuConfiguration,
} from '../controllers/menuConfigurationController';
import authenticateToken from '../middlewares/authMiddleware';

const router = Router();

// Get all menu configurations
router.get('/getAllMenuConfigurations', authenticateToken, getAllMenuConfigurations);

// Create a new menu configuration
router.post('/createMenuConfiguration', authenticateToken, createMenuConfiguration);

// Update an existing menu configuration
router.put('/updateMenuConfiguration', authenticateToken, updateMenuConfiguration);

// Delete a menu configuration
router.delete('/deleteMenuConfiguration', authenticateToken, deleteMenuConfiguration);

export default router;