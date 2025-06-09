import { sequelize } from '../config/database';
import { Request, Response } from 'express'; // Added Response import
import Cart from '../models/cart';
import CartItem from '../models/cartItem';
import Order from '../models/order';
import OrderItem from '../models/orderItem';
import Payment from '../models/payment';
import logger from '../common/logger';
import { getMessage } from '../common/utils';
import { statusCodes } from '../common/statusCodes';
import { Transaction } from 'sequelize';
import QRCode from 'qrcode'; // Import QRCode library
import dotenv from 'dotenv';
import Canteen from '../models/canteen';
import Item from '../models/item';
import axios from 'axios';
import { PaymentLink } from '../common/utils';
import Wallet from '../models/wallet';
import moment from 'moment-timezone'; // Import moment-timezone
moment.tz('Asia/Kolkata')
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models';


dotenv.config();

export const placeOrder = async (req: Request, res: Response): Promise<Response> => {
  const transaction: Transaction = await sequelize.transaction();

  try {
    console.log("placeordererror",100)

    const { userId } = req.user as unknown as { userId: string };
    console.log("placeordererror",userId)

    const { paymentMethod, transactionId, currency = 'INR' } = req.body;

    if (!userId || !paymentMethod) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['userId and paymentMethod are required'],
      });
    }

    // Ensure userId is a string
    const userIdString = String(userId);

    const cart: any = await Cart.findOne({
      where: { userId: userIdString, status: 'active' },
      include: [{ model: CartItem, as: 'cartItems' }],
      transaction,
    });

    if (!cart || !cart.cartItems || cart.cartItems.length === 0) {
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('cart.empty'),
      });
    }

    const amount = cart.totalAmount;
    const gatewayPercentage = 0;
    const gatewayCharges = (amount * gatewayPercentage) / 100;
    const totalAmount = amount + gatewayCharges;

    // Create the order
    let oderStatus= 'placed';
    if(paymentMethod.includes('online')){
      oderStatus= 'initiated';
    }
    const order = await Order.create(
      {
        userId: userIdString,
        totalAmount: cart.totalAmount,
        status: oderStatus,
        canteenId: cart.canteenId,
        menuConfigurationId: cart.menuConfigurationId,
        createdById: userIdString,
        orderDate: cart.orderDate,
      },
      { transaction }
    );

    // Generate QR Code
    const qrCodeData = `${process.env.BASE_URL}/api/order/${order.id}`;
    const qrCode = await QRCode.toDataURL(qrCodeData);

    // Update the order with the QR code
    order.qrCode = qrCode;
    await order.save({ transaction });

    // Create order items
    const orderItems = cart.cartItems.map((cartItem: any) => ({
      orderId: order.id,
      itemId: cartItem.itemId,
      quantity: cartItem.quantity,
      price: cartItem.price,
      total: cartItem.total,
      createdById: userIdString,
    }));
    await OrderItem.bulkCreate(orderItems, { transaction });

    // Handle wallet payment
    let walletPaymentAmount = 0;
    let remainingAmount = totalAmount;
    if (paymentMethod.includes('wallet')) {
      const creditSum = await Wallet.sum('amount', {
        where: { userId: userIdString, type: 'credit' },
        transaction,
      });

      const debitSum = await Wallet.sum('amount', {
        where: { userId: userIdString, type: 'debit' },
        transaction,
      });

      const walletBalance = (creditSum || 0) - (debitSum || 0);

      if (walletBalance > 0) {
        walletPaymentAmount = Math.min(walletBalance, totalAmount);
        remainingAmount = totalAmount - walletPaymentAmount;

        // Create a wallet debit transaction
        await Wallet.create(
          {
            userId: userIdString,
            referenceId: order.id,
            type: 'debit',
            amount: walletPaymentAmount,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000),
          },
          { transaction }
        );

        // Create a payment record for the wallet
        await Payment.create(
          {
            orderId: order.id,
            userId: userIdString,
            paymentMethod: 'wallet',
            transactionId: null,
            amount: walletPaymentAmount,
            gatewayPercentage,
            gatewayCharges: 0,
            totalAmount: walletPaymentAmount,
            currency,
            status: 'success',
            createdById: userIdString,
            updatedById: userIdString,
          },
          { transaction }
        );
      }
    }
    let linkResponse = null;
    // Handle remaining payment
    if (remainingAmount > 0) {
      let status = 'success';
     


    let newpayment =  await Payment.create(
        {
          orderId: order.id,
          userId: userIdString,
          paymentMethod: paymentMethod.includes('online') ? 'online' : 'cash',
          transactionId: transactionId || null,
          amount: remainingAmount,
          gatewayPercentage,
          gatewayCharges,
          totalAmount: remainingAmount,
          currency,
          status: status,
          createdById: userIdString,
          updatedById: userIdString,
        },
        { transaction }
      );
      if (paymentMethod.includes('cash')) {
        status = 'success';
      } else if (paymentMethod.includes('online')) {
        status = 'pending';
        
        linkResponse = await PaymentLink(order, newpayment, req.user);
      }

      // Create a payment record for the remaining amount
   
    }

    // Clear the cart
    await CartItem.destroy({ where: { cartId: cart.id }, transaction });
    await cart.destroy({ transaction });

    // Commit the transaction
    await transaction.commit();

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('order.placed'),
      data: {
        order,
        payments: {
          walletPaymentAmount,
          remainingAmount,
        },
        qrCode,
        paymentlink:linkResponse
      },
    });
  } catch (error: unknown) {
    await transaction.rollback();
    console.log("placeordererror",error)
    logger.error(`Error placing order: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const listOrders = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.user as unknown as { userId: string }; // Extract userId from the request

    if (!userId) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['userId is required'],
      });
    }

    // Fetch all orders for the user
    const orders = await Order.findAll({
      where: { userId },
      include: [
        {
          model: OrderItem,
          as: 'orderItems', // Ensure this matches the alias in the Order -> OrderItem association
          include: [
            {
              model: Item,
              as: 'menuItemItem', // Ensure this matches the alias in the OrderItem -> Item association
              attributes: ['id', 'name', 'description'], // Fetch necessary item fields
            },
          ],
        },
        {
          model: Payment,
          as: 'payment', // Ensure this matches the alias in the Order -> Payment association
          attributes: ['id', 'amount', 'status', 'paymentMethod'], // Fetch necessary payment fields
        },
      ],
      order: [['createdAt', 'DESC']], // Sort by most recent orders
    });

    if (!orders || orders.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('order.noOrdersFound'),
      });
    }

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('order.listFetched'),
      data: orders,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching orders: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getOrderById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.query as { id: string }; // Extract userId from the request
    if (!id) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['Order ID is required'],
      });
    }

    // Fetch the order by ID
    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: 'orderItems', // Ensure this matches the alias in the Order -> OrderItem association
          include: [
            {
              model: Item,
              as: 'menuItemItem', // Ensure this matches the alias in the OrderItem -> Item association
              attributes: ['id', 'name', 'description', 'image'], // Fetch necessary item fields
            },
          ],
        },
        {
          model: Payment,
          as: 'payment', // Ensure this matches the alias in the Order -> Payment association
          attributes: ['id', 'amount', 'status', 'paymentMethod'], // Fetch necessary payment fields
        },
        {
          model: Canteen,
          as: 'orderCanteen', // Ensure this matches the alias in the Order -> Canteen association
          attributes: ['id', 'canteenName'], // Fetch necessary canteen fields
        },
      ],
    });

    if (!order) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('order.notFound'),
      });
    }

    // Convert item images to Base64
    const orderData = order.toJSON();
    orderData.orderItems = orderData.orderItems.map((orderItem: any) => {
      if (orderItem.menuItemItem && orderItem.menuItemItem.image) {
        orderItem.menuItemItem.image = Buffer.from(orderItem.menuItemItem.image).toString('base64');
      }
      return orderItem;
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('order.fetched'),
      data: orderData,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching order by ID: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getAllOrders = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Fetch all orders
    const orders = await Order.findAll({
      include: [
        {
          model: OrderItem,
          as: 'orderItems',
          include: [
            {
              model: Item,
              as: 'menuItemItem', // Ensure this matches the alias in the OrderItem -> Item association
              attributes: ['id', 'name'], // Fetch item name and ID
            },
          ],
        },
        {
          model: Payment,
          as: 'payment',
          attributes: ['id', 'amount', 'status', 'paymentMethod'], // Fetch necessary payment fields
        },
      ],
      order: [['createdAt', 'DESC']], // Sort by most recent orders
    });

    if (!orders || orders.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('order.noOrdersFound'),
      });
    }

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('order.allOrdersFetched'),
      data: orders,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching all orders: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getOrdersSummary = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Fetch total orders count and total amount

    const result = await Order.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'], // Count total orders
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalAmount'], // Sum total amount
      ],
      where: { status: 'placed' }, // Filter by status 'placed'
    });

    const summary = result[0]?.toJSON();

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('order.summaryFetched'),
      data: summary,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching orders summary: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getOrdersByCanteen = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Fetch total orders and total amount grouped by canteen name
    const result = await Order.findAll({
      attributes: [
        [sequelize.col('Canteen.canteenName'), 'canteenName'], // Use the correct column name
        [sequelize.fn('COUNT', sequelize.col('Order.id')), 'totalOrders'], // Count total orders
        [sequelize.fn('SUM', sequelize.col('Order.totalAmount')), 'totalAmount'], // Sum total amount
      ],
      include: [
        {
          model: Canteen, // Ensure the model is correctly imported
          as: 'Canteen', // Alias must match the association
          attributes: [], // Exclude additional Canteen attributes
        },
      ],
      group: ['Canteen.canteenName'], // Group by the correct column name
      where: { status: 'placed' }, // Filter by status 'placed'
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('order.canteenSummaryFetched'),
      data: result,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching orders by canteen: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const processCashfreePayment = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { orderId, amount, currency = 'INR', customerName, customerEmail, customerPhone } = req.body;

    // Validate required fields
    if (!orderId || !amount || !customerName || !customerEmail || !customerPhone) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['orderId, amount, customerName, customerEmail, and customerPhone are required'],
      });
    }

    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/pg';

    console.log('CASHFREE_APP_ID', CASHFREE_APP_ID);
    console.log('CASHFREE_SECRET_KEY', CASHFREE_SECRET_KEY);

    console.log('CASHFREE_BASE_URL', CASHFREE_BASE_URL);

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Cashfree credentials are not configured',
      });
    }

    // Create order payload for Cashfree
    const payload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: currency,
      customer_details: {
        customer_id: orderId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${process.env.BASE_URL}/api/order/cashfreecallback?order_id={order_id}`,
      },
    };

    // Log headers and payload for debugging
    logger.info('Cashfree Headers:', {
      clientId: CASHFREE_APP_ID,
      clientSecret: CASHFREE_SECRET_KEY,
    });
    logger.info('Cashfree Payload:', payload);

    // Make API request to Cashfree to create an order
    const response = await axios.post(`${CASHFREE_BASE_URL}/orders`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': '2023-08-01',
      },
    });

    // Handle Cashfree response
    if (response.status === 200 && response.data) {
      const { cf_order_id, payment_session_id } = response.data;

      // Construct the payment link
      const paymentLink = `https://sandbox.cashfree.com/pg/orders/${cf_order_id}`;

      return res.status(statusCodes.SUCCESS).json({
        message: 'Cashfree order created successfully',
        data: {
          orderId,
          paymentLink,
          paymentSessionId: payment_session_id,
        },
      });
    } else {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to create Cashfree order',
        data: response.data,
      });
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      logger.error('Cashfree Error Response:', error.response?.data);
    }
    logger.error(`Error processing Cashfree payment: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const cashfreeCallback = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get parameters from either query params (GET) or request body (POST)
    const order_id = req.method === 'GET' ? req.query.order_id : req.body.order_id;
    const payment_status = req.method === 'GET' ? req.query.payment_status : req.body.payment_status;
    const payment_amount = req.method === 'GET' ? req.query.payment_amount : req.body.payment_amount;
    const payment_currency = req.method === 'GET' ? req.query.payment_currency : req.body.payment_currency;
    const transaction_id = req.method === 'GET' ? req.query.transaction_id : req.body.transaction_id;

    console.log(order_id, payment_status, payment_amount, payment_currency, transaction_id);

    // Return a placeholder response for now
    return res.status(statusCodes.SUCCESS).json({
      message: 'Callback processed successfully',
      data: {
        order_id,
        payment_status,
        payment_amount,
        payment_currency,
        transaction_id,
      },
    });
  } catch (error: unknown) {
    logger.error(`Error processing Cashfree callback: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const createPaymentLink = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { orderId, amount, currency = 'INR', customerName, customerEmail, customerPhone } = req.body;

    // Validate required fields
    if (!orderId || !amount || !customerName || !customerEmail || !customerPhone) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['orderId, amount, customerName, customerEmail, and customerPhone are required'],
      });
    }

    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/pg';

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Cashfree credentials are not configured',
      });
    }

    // Create order payload for Cashfree
    const payload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: currency,
      customer_details: {
        customer_id: orderId, // Use orderId as customer_id for simplicity
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${process.env.BASE_URL}/api/order/cashfreecallback?order_id={order_id}`,
      },
    };

    // Log headers and payload for debugging
    logger.info('Cashfree Headers:', {
      clientId: CASHFREE_APP_ID,
      clientSecret: CASHFREE_SECRET_KEY,
    });
    logger.info('Cashfree Payload:', payload);

    // Make API request to Cashfree to create an order
    const response = await axios.post(`${CASHFREE_BASE_URL}/orders`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': '2023-08-01',
      },
    });

    // Handle Cashfree response
    if (response.status === 200 && response.data) {
      const { cf_order_id, payment_session_id } = response.data;

      // Construct the payment link
      const paymentLink = `${CASHFREE_BASE_URL}/orders/${cf_order_id}`;

      return res.status(statusCodes.SUCCESS).json({
        message: 'Cashfree payment link created successfully',
        data: {
          orderId,
          paymentLink,
          paymentSessionId: payment_session_id,
        },
      });
    } else {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to create Cashfree payment link',
        data: response.data,
      });
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      logger.error('Cashfree Error Response:', error.response?.data);
    }
    logger.error(`Error creating Cashfree payment link: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const createCashfreePaymentLink = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { linkId, amount, currency = 'INR', customerName, customerEmail, customerPhone, description } = req.body;

    // Validate required fields
    if (!linkId || !amount || !customerName || !customerEmail || !customerPhone) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['linkId, amount, customerName, customerEmail, and customerPhone are required'],
      });
    }

    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/pg';

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Cashfree credentials are not configured',
      });
    }

    // Create payload for Cashfree payment link
    const payload = {
      link_id: linkId,
      link_amount: amount,
      link_currency: currency,
      customer_details: {
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      link_meta: {
        return_url: `${process.env.BASE_URL}/api/order/cashfreecallback`,
        notify_url: `${process.env.BASE_URL}/api/order/cashfreecallback`, // Add notify URL
      },
      link_notify: {
        send_sms: false,
        send_email: false,
        payment_received: false,
      },
      link_payment_methods: ["upi"], // Restrict payment methods to UPI only
      link_purpose: description || 'Payment Link',
    };

    // Log headers and payload for debugging
    logger.info('Cashfree Headers:', {
      clientId: CASHFREE_APP_ID,
      clientSecret: CASHFREE_SECRET_KEY,
    });
    logger.info('Cashfree Payload:', payload);

    // Make API request to Cashfree to create a payment link
    const response = await axios.post(`${CASHFREE_BASE_URL}/links`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': '2023-08-01',
      },
    });

    // Handle Cashfree response
    if (response.status === 200 && response.data) {
      const { link_id, link_url } = response.data;

      return res.status(statusCodes.SUCCESS).json({
        message: 'Cashfree payment link created successfully',
        data: {
          linkId: link_id,
          paymentLink: link_url,
        },
      });
    } else {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to create Cashfree payment link',
        data: response.data,
      });
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      logger.error('Cashfree Error Response:', error.response?.data);
    }
    logger.error(`Error creating Cashfree payment link: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const CashfreePaymentLinkDetails = async (req: Request, res: Response): Promise<Response> => {
  const transaction = await sequelize.transaction(); // Start a transaction

  try {
    const { linkId } = req.body; // Extract linkId from the request body

    if (!linkId) {
      return res.status(400).json({
        message: 'linkId is required to fetch payment details.',
      });
    }

    // Extract the numeric part from the linkId
    const numericPart = linkId.split('_').pop(); // Extracts the part after the last underscore
    if (!numericPart || isNaN(Number(numericPart))) {
      return res.status(400).json({
        message: 'Invalid linkId format. Expected format: testcash_link_<number>',
      });
    }


    // Fetch the payment record from the database using the numericPart
    const payment = await Payment.findOne({
      where: { id: numericPart }, // Assuming `id` is the primary key in the Payment table
      transaction, // Use the transaction
    });

    if (!payment) {
      await transaction.rollback(); // Rollback the transaction if no payment is found
      return res.status(404).json({
        message: `No payment record found for numericPart: ${numericPart}`,
      });
    }

    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/pg';

    // Make an API call to Cashfree to fetch payment details using the linkId
    const response = await axios.get(`${CASHFREE_BASE_URL}/links/${linkId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': '2023-08-01',
      },
    });

    // Handle Cashfree response
    if (response.status === 200 && response.data) {
      const paymentDetails = response.data;

      // Update the payment record in the database
      payment.status = paymentDetails.link_status === 'PAID' ? 'success' : 'pending';
      payment.transactionId = paymentDetails.transaction_id || payment.transactionId;
      await payment.update(
        {
          status: paymentDetails.link_status === 'PAID' ? 'success' : 'pending',
          transactionId: paymentDetails.transaction_id || payment.transactionId,
          updatedAt: new Date(),
        },
        { transaction }
      ); // Update the status, transactionId, and timestamp within the transaction

      // Update the order status based on payment success
      if (paymentDetails.link_status === 'PAID') {
        const order = await Order.findByPk(payment.orderId, { transaction });
        if (order) {
          order.status = 'placed';
          if(order.qrCode === null || order.qrCode === undefined){
            const qrCodeData = `${process.env.BASE_URL}/api/order/${order.id}`; 
            const qrCode = await QRCode.toDataURL(qrCodeData);
            order.qrCode = qrCode; // Generate and set the QR code if it's not already set  
            console.log('order.userId', order.userId);
            sendWhatsQrAppMessage(order); // Send WhatsApp message with QR code
            }
          await order.save({ transaction });
        }
      }
      // Commit the transaction
      await transaction.commit();

      // Return the updated payment details as a response
      return res.status(200).json({
        message: 'Payment details updated successfully.',
        data: {
          payment,
          cashfreeDetails: paymentDetails,
        },
      });
    } else {
      // Rollback the transaction if the API call fails
      await transaction.rollback();
      return res.status(400).json({
        message: 'Failed to fetch payment details from Cashfree.',
        error: response.data,
      });
    }
  } catch (error: unknown) {
    await transaction.rollback(); // Rollback the transaction in case of any error
    console.error('Error fetching or updating payment details from Cashfree:', error);
    return res.status(500).json({
      message: 'An error occurred while fetching or updating payment details from Cashfree.',
    });
  }
};

function generateUuid(): string {
  return uuidv4();
}
interface WhatsAppMessagePayload {
  sessionId: string;
  to: string; // Recipient number
  from: string; // Sender number
  message: {
    text: string;
  };
  mediaAttachment?: {
    type: string;
    id: string;
  };
}

const sendWhatsQrAppMessage = async (order: any): Promise<void> => {
  const userId = order.userId; // Extract userId from the order object
  const user:any = await User.findOne({ where: { id: userId } }); // Fetch user details from the User table
  const phoneNumber = user?.mobile; // Get the phone number from the user details

  console.log('sendWhatsQrAppMessage', order.userId, phoneNumber);

  const url = 'https://iqwhatsapp.airtel.in/gateway/airtel-xchange/basic/whatsapp-manager/v1/session/send/media';
  const username = 'world_tek';
  const password = 'T7W9&w3396Y"'; // Replace with actual password

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const payload: WhatsAppMessagePayload = {
    sessionId: generateUuid(),
    to: "91".concat(phoneNumber), // Recipient number
    from: "918686078782", // Dynamically set the sender number
    message: {
      text: 'Your Order is Placed', // Message text
    },
    mediaAttachment: {
        "type": "IMAGE",
        "id": order.qrCode
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

     console.log('Message sent successfully:', response.data);
  } catch (error: any) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
};

export const cancelOrder = async (req: Request, res: Response): Promise<Response> => {
  const transaction = await sequelize.transaction(); // Start a transaction

  try {
    const { orderId } = req.body; // Extract orderId from the request body

    if (!orderId) {
      return res.status(400).json({
        message: 'Order ID is required to cancel the order.',
      });
    }

    // Fetch the order by ID
    const order: any = await Order.findOne({
      where: { id: orderId, status: 'placed' }, // Ensure the order is in 'placed' status
      include: [
        {
          model: Payment,
          as: 'payment', // Ensure this matches the alias in the Order -> Payment association
        },
      ],
      transaction, // Use the transaction
    });

    if (!order) {
      await transaction.rollback(); // Rollback the transaction if no valid order is found
      return res.status(404).json({
        message: 'No valid order found with the provided ID.',
      });
    }

    // Update the order status to 'canceled'
    order.status = 'canceled';
    await order.save({ transaction });

    // Process all associated payments using map
    const payments = order.payment; // Fetch all payments associated with the order
    let totalRefundAmount = 0;

    await Promise.all(
      payments.map(async (payment: any) => {
        if (payment.status === 'success') {
          totalRefundAmount += payment.amount;

          // Handle wallet payment refund
          if (payment.paymentMethod === 'wallet' || payment.paymentMethod === 'online') {
            await Wallet.create(
              {
                userId: order.userId, // Assuming `userId` is available in the order
                referenceId: orderId, // Use the orderId as the referenceId
                type: 'credit', // Indicate this is a credit transaction
                amount: payment.amount, // Refund the payment amount
                createdAt: Math.floor(Date.now() / 1000), // Store as Unix timestamp
                updatedAt: Math.floor(Date.now() / 1000), // Store as Unix timestamp
              },
              { transaction }
            );
          }

          // Update the payment status to 'refunded'
          payment.status = 'refunded';
          await payment.save({ transaction });
        }
      })
    );

    // Commit the transaction
    await transaction.commit();

    return res.status(200).json({
      message: 'Order canceled successfully. Refund processed for all payments.',
      data: {
        orderId: order.id,
        orderStatus: order.status,
        totalRefundAmount,
      },
    });
  } catch (error: unknown) {
    await transaction.rollback(); // Rollback the transaction in case of any error
    console.error('Error canceling order:', error);
    return res.status(500).json({
      message: 'An error occurred while canceling the order.',
    });
  }
};

export const getWalletTransactions = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.user as unknown as { userId: string }; // Extract userId from the request

    if (!userId) {
      return res.status(400).json({
        message: 'User ID is required to fetch wallet transactions.',
      });
    }

    // Ensure userId is a string
    const userIdString = String(userId);

    // Fetch wallet transactions for the user
    const transactions = await Wallet.findAll({
      where: { userId: userIdString }, // Ensure the type matches the database column
      order: [['createdAt', 'DESC']], // Sort by most recent transactions
    });

    if (!transactions || transactions.length === 0) {
      return res.status(404).json({
        message: 'No wallet transactions found for this user.',
      });
    }

    // Calculate the wallet balance for the user
    const creditSum = await Wallet.sum('amount', {
      where: { userId: userIdString, type: 'credit' },
    });

    const debitSum = await Wallet.sum('amount', {
      where: { userId: userIdString, type: 'debit' },
    });

    const walletBalance = (creditSum || 0) - (debitSum || 0); // Calculate the balance

    return res.status(200).json({
      message: 'Wallet transactions fetched successfully.',
      data: {
        transactions,
        walletBalance, // Include the available balance in the response
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching wallet transactions:', error);
    return res.status(500).json({
      message: 'An error occurred while fetching wallet transactions.',
    });
  }
};

export const getWalletBalance = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.user as unknown as { userId: string }; // Extract userId from the request

    if (!userId) {
      return res.status(400).json({
        message: 'User ID is required to fetch wallet balance.',
      });
    }

    // Ensure userId is a string
    const userIdString = String(userId);

    // Calculate the wallet balance for the user
    const creditSum = await Wallet.sum('amount', {
      where: { userId: userIdString, type: 'credit' },
    });

    const debitSum = await Wallet.sum('amount', {
      where: { userId: userIdString, type: 'debit' },
    });

    const walletBalance = (creditSum || 0) - (debitSum || 0); // Calculate the balance

    return res.status(200).json({
      message: 'Wallet balance fetched successfully.',
      data: {
        userId: userIdString,
        walletBalance,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching wallet balance:', error);
    return res.status(500).json({
      message: 'An error occurred while fetching wallet balance.',
    });
  }
};


