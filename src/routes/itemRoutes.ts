import { Router } from 'express';
import { createItem ,getAllItems,getAllItemsCount,setItemInactive} from '../controllers/itemController';
import authenticateToken from '../middlewares/authMiddleware'; // Import the authentication middleware
import upload from '../middlewares/multerConfig';

const router = Router();

router.post('/createItem',authenticateToken,upload.single('image'), createItem);


router.get('/getItems', getAllItems);

router.get('/getAllItemsCount', getAllItemsCount);


router.patch('/items/:itemId/inactive', setItemInactive);


export default router;