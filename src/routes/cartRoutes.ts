import express from 'express';
import {
  addToCart,
  updateCartItem,
  removeCartItem,
  getCart,
  clearCart,createCart,placeOrderWithMobile,
  addToCartForIOS
} from '../controllers/cartController';
import authenticateToken from '../middlewares/authMiddleware'; // Import the authentication middleware

const router = express.Router();

// Cart routes
router.post('/add', authenticateToken, addToCart);

router.post('/addToCartForIOS', authenticateToken, addToCartForIOS);


router.get('/getCart', authenticateToken, getCart);

router.post('/updateCartItem', authenticateToken, updateCartItem);

router.post('/removeCartItem', authenticateToken, removeCartItem);

// Fix the route for clearing the cart
router.get('/clearCart', authenticateToken, clearCart);


router.get('/createCart', authenticateToken, createCart);


router.get('/placeOrderWithMobile', authenticateToken, placeOrderWithMobile);


export default router;