import { Router } from 'express';
import { Cashfree, CFEnvironment } from 'cashfree-pg';

const router = Router();

//here we should keep production when we are ready to go live
// const clientId = process.env.CASHFREE_CLIENT_ID || '';
// const clientSecret = process.env.CASHFREE_CLIENT_SECRET || '';
const env = CFEnvironment.PRODUCTION 

const clientId = process.env.pgAppID;
    const clientSecret = process.env.pgSecreteKey;

console.log("clientId",clientId)
console.log("clientSecret",clientSecret)
// this is local
// const clientId = process.env.CASHFREE_CLIENT_ID_sandbox || '';
// const clientSecret = process.env.CASHFREE_CLIENT_SECRET_sandbox || '';
// const env = CFEnvironment.SANDBOX;

const returnUrl = process.env.CASHFREE_RETURN_URL || 'https://welfarecanteen.in/payment-status';

// Initialize Cashfree SDK
const cashfree = new Cashfree(env, clientId, clientSecret);

console.log(env, clientId, clientSecret)



router.post('/createOrder', async (req, res) => {
  console.log("request",req.body)
  const { customer_id, customer_email, customer_phone, order_amount = '1.00', order_currency = 'INR' } = req.body;


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
    console.log('Cashfree Order Request:', orderRequest);
    const response = await cashfree.PGCreateOrder(orderRequest);
    console.log('Cashfree Order Error:', response);

    res.status(201).json(response.data);
  } catch (error: any) {
    console.error('Cashfree Order Error:', error?.response?.data ?? error.message);
    res.status(500).json({
      error: 'Cashfree order creation failed.',
      reason: error?.response?.data?.message || 'Internal server error',
    });
  }
});

export default router;
