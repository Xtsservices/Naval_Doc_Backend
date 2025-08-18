import { Router } from 'express';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import authenticateToken from '../middlewares/authMiddleware'; // Middleware for authentication
import { Cart, CartItem } from '../models';
import transaction from 'sequelize/types/transaction';
import { statusCodes } from '../common/statusCodes';
import { validateOrderDateAndCutoff } from '../controllers/orderController';

const router = Router();

//here we should keep production when we are ready to go live
// const clientId = process.env.CASHFREE_CLIENT_ID || '';
// const clientSecret = process.env.CASHFREE_CLIENT_SECRET || '';
const env = CFEnvironment.PRODUCTION 

const clientId = process.env.pgAppID;
    const clientSecret = process.env.pgSecreteKey;
// this is local
// const clientId = process.env.CASHFREE_CLIENT_ID_sandbox || '';
// const clientSecret = process.env.CASHFREE_CLIENT_SECRET_sandbox || '';
// const env = CFEnvironment.SANDBOX;

const returnUrl = process.env.CASHFREE_RETURN_URL || 'https://welfarecanteen.in/payment-status';

// Initialize Cashfree SDK
const cashfree = new Cashfree(env, clientId, clientSecret);




router.post('/createOrder',  async (req, res) => {




  const { customer_id, customer_email, customer_phone, order_amount, order_currency = 'INR' } = req.body;

  if (!customer_id || !customer_email || !customer_phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const orderRequest = {
    order_amount,
    order_currency,
    customer_details: {
      customer_id,
      customer_name: 'Demo User',
      customer_email,
      customer_phone,
    },
    order_meta: {
      return_url: `${returnUrl}?order_id=${customer_id}`,
    },
    order_note: 'Test order from React Native app',
  };

  try {

    //     const { userId } = req.user as unknown as { userId: string };

    //      const userIdString = String(userId);

    // const cart: any = await Cart.findOne({
    //   where: { userId: userIdString, status: "active" },
    //   include: [{ model: CartItem, as: "cartItems" }],
    // });

    // if (!cart || !cart.cartItems || cart.cartItems.length === 0) {
    //   return res.status(statusCodes.NOT_FOUND).json({
    //     message:" Cart not found or empty for user",
    //   });
    // }

    // // Check if the canteenId and menuConfigurationId are present in the cart
    // const canteenId = cart.canteenId;
    // const menuConfigurationId = cart.menuConfigurationId;

    // if (!canteenId || !menuConfigurationId) {
    //   return res.status(statusCodes.NOT_FOUND).json({
    //     message: "Canteen or menu configuration not found",
    //   });
    // } 


   

    // // Check if the order date is in the past (previous date)
    // // Validate order date and cutoff time
    // // Start a transaction
    // const sequelize = Cart.sequelize;
    // if (!sequelize) {
    //   return res.status(500).json({ message: "Database connection error" });
    // }
    // const dbTransaction = await sequelize.transaction();

    // try {
    //   const orderDateValidationResult = await validateOrderDateAndCutoff(cart, menuConfigurationId, dbTransaction);

    //   if (!orderDateValidationResult.success) {
    //   await dbTransaction.rollback();
    //   return res.status(orderDateValidationResult.statusCode).json({
    //     message: orderDateValidationResult.message,
    //   });
    //   }

    //   // ... (rest of your logic, e.g., order creation)

    //   await dbTransaction.commit();
    // } catch (err) {
    //   await dbTransaction.rollback();
    //   throw err;
    // }
   



    const response = await cashfree.PGCreateOrder(orderRequest);
    res.status(201).json(response.data);
  } catch (error: any) {
    res.status(500).json({
      error: 'Cashfree order creation failed.',
      reason: error?.response?.data?.message || 'Internal server error',
    });
  }
});

export default router;
