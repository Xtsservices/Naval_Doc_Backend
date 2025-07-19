import { sequelize } from "../config/database";
import { Request, Response } from "express"; // Added Response import
import Cart from "../models/cart";
import CartItem from "../models/cartItem";
import Order from "../models/order";
import OrderItem from "../models/orderItem";
import Payment from "../models/payment";
import logger from "../common/logger";
import { getMessage, sendOrderSMS } from "../common/utils";
import { statusCodes } from "../common/statusCodes";
import { Transaction } from "sequelize";
import QRCode from "qrcode"; // Import QRCode library
import dotenv from "dotenv";
import Canteen from "../models/canteen";
import Item from "../models/item";
import axios from "axios";
import { PaymentLink } from "../common/utils";
import Wallet from "../models/wallet";
import moment from "moment-timezone"; // Import moment-timezone
moment.tz("Asia/Kolkata");
import { v4 as uuidv4 } from "uuid";
import { User } from "../models";
import { sendWhatsAppMessage, sendImageWithoutAttachment, uploadImageToAirtelAPI } from "../index";

import { Op } from "sequelize"; // Import Sequelize operators
import fs from 'fs';
import path from 'path';
import { constants } from "buffer";
dotenv.config();

export const placeOrder = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const transaction: Transaction = await sequelize.transaction();

  try {

    const { userId } = req.user as unknown as { userId: string };

    const { paymentMethod, transactionId, currency = "INR", platform } = req.body;

    if (!userId || !paymentMethod) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage("validation.validationError"),
        errors: ["userId and paymentMethod are required"],
      });
    }


    // Ensure userId is a string
    const userIdString = String(userId);

    const cart: any = await Cart.findOne({
      where: { userId: userIdString, status: "active" },
      include: [{ model: CartItem, as: "cartItems" }],
      transaction,
    });

    if (!cart || !cart.cartItems || cart.cartItems.length === 0) {
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage("cart.empty"),
      });
    }

    const amount = cart.totalAmount;
    const gatewayPercentage = 0;
    const gatewayCharges = (amount * gatewayPercentage) / 100;
    const totalAmount = amount + gatewayCharges;

    // Create the order
    let oderStatus = "initiated";
    if (paymentMethod.includes("online")) {
      oderStatus = "initiated";
    }

    if (platform && platform === "mobile") {
      oderStatus = "placed";
    }
    // Generate a unique order number (e.g., NV + order timestamp + random 4 digits)
    // Generate a unique order number (e.g., NV + order timestamp + random 4 digits)
    // Ensure uniqueness by checking the database and retrying if necessary
    // Generate a unique order number using utility function
    const orderNo = await generateUniqueOrderNo(userId, transaction);
    if (!orderNo) {
      await transaction.rollback();
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Failed to generate a unique order number. Please try again.",
      });
    }
    console.log("oderStatus:", oderStatus);
    const order = await Order.create(
      {
        userId: userIdString,
        totalAmount: cart.totalAmount,
        status: oderStatus,
        canteenId: cart.canteenId,
        menuConfigurationId: cart.menuConfigurationId,
        createdById: userIdString,
        orderDate: cart.orderDate,
        orderNo, // Add the generated order number
      },
      { transaction }
    );

    // Generate QR Code
    const qrCodeData = `${process.env.BASE_URL}/api/order/${order.id}`;
    const qrCode = await QRCode.toDataURL(qrCodeData);

    // Update the order with the QR code
    order.qrCode = qrCode;
    await Order.update(
      { qrCode },
      {
        where: { id: order.id },
        transaction
      }
    );

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
    if (paymentMethod.includes("wallet")) {
      const creditSum = await Wallet.sum("amount", {
        where: { userId: userIdString, type: "credit" },
        transaction,
      });

      const debitSum = await Wallet.sum("amount", {
        where: { userId: userIdString, type: "debit" },
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
            type: "debit",
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
            paymentMethod: "wallet",
            transactionId: null,
            amount: walletPaymentAmount,
            gatewayPercentage,
            gatewayCharges: 0,
            totalAmount: walletPaymentAmount,
            currency,
            status: "success",
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
      let status = "pending"; // Default status for online payments

      if (paymentMethod.includes("online")) {
        status = "pending"; // Default status for online payments
      }

      if (platform && platform === "mobile") {
        status = "placed";
      }

      let newpayment = await Payment.create(
        {
          orderId: order.id,
          userId: userIdString,
          paymentMethod: paymentMethod.includes("online") ? "online" : "cash",
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
      if (paymentMethod.includes("cash")) {
        status = "success";
      } else if (paymentMethod.includes("online")) {
        status = "pending";

        if (platform && platform === "mobile") {
          status = "placed";
        }
        if (status === "pending") {
          linkResponse = await PaymentLink(order, newpayment, req.user);
        }

      }

      // Create a payment record for the remaining amount
    }

    // Clear the cart
    await CartItem.destroy({ where: { cartId: cart.id }, transaction });
    await cart.destroy({ transaction });

    // Commit the transaction
    await transaction.commit();

    if (order.status === "placed") {
      console.log(`Order placed successfully: ${order.id}`);
      const { base64, filePath } = await generateOrderQRCode(order, transaction);

      if (filePath) {
        let whatsappuploadedid = await uploadImageToAirtelAPI(filePath)
        console.log("whatsappuploadedid", whatsappuploadedid);
        sendWhatsQrAppMessage(order, whatsappuploadedid)
      }

    }

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("order.placed"),
      data: {
        order,
        payments: {
          walletPaymentAmount,
          remainingAmount,
        },
        qrCode,
        paymentlink: linkResponse,
      },
    });
  } catch (error: unknown) {
    console.log("placeordererror", error);

    await transaction.rollback();
    logger.error(
      `Error placing order: ${error instanceof Error ? error.message : error}`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const listOrders = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { userId } = req.user as unknown as { userId: string }; // Extract userId from the request

    if (!userId) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage("validation.validationError"),
        errors: ["userId is required"],
      });
    }

    // Fetch all orders for the user
    const orders = await Order.findAll({
      where: { userId },
      include: [
        {
          model: OrderItem,
          as: "orderItems", // Ensure this matches the alias in the Order -> OrderItem association
          include: [
            {
              model: Item,
              as: "menuItemItem", // Ensure this matches the alias in the OrderItem -> Item association
              attributes: ["id", "name", "description"], // Fetch necessary item fields
            },
          ],
        },
        {
          model: Payment,
          as: "payment", // Ensure this matches the alias in the Order -> Payment association
          attributes: ["id", "amount", "status", "paymentMethod"], // Fetch necessary payment fields
        },
      ],
      order: [["createdAt", "DESC"]], // Sort by most recent orders
    });

    if (!orders || orders.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage("order.noOrdersFound"),
      });
    }

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("order.listFetched"),
      data: orders,
    });
  } catch (error: unknown) {
    logger.error(
      `Error fetching orders: ${error instanceof Error ? error.message : error}`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const getOrderById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.query as { id: string }; // Extract userId from the request
    if (!id) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage("validation.validationError"),
        errors: ["Order ID is required"],
      });
    }

    // Fetch the order by ID
    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: "orderItems", // Ensure this matches the alias in the Order -> OrderItem association
          include: [
            {
              model: Item,
              as: "menuItemItem", // Ensure this matches the alias in the OrderItem -> Item association
              attributes: ["id", "name", "description", "image"], // Fetch necessary item fields
            },
          ],
        },
        {
          model: Payment,
          as: "payment", // Ensure this matches the alias in the Order -> Payment association
          attributes: ["id", "amount", "status", "paymentMethod"], // Fetch necessary payment fields
        },
        {
          model: Canteen,
          as: "orderCanteen", // Ensure this matches the alias in the Order -> Canteen association
          attributes: ["id", "canteenName"], // Fetch necessary canteen fields
        },
      ],
    });

    if (!order) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage("order.notFound"),
      });
    }

    // Convert item images to Base64
    const orderData = order.toJSON();
    orderData.orderItems = orderData.orderItems.map((orderItem: any) => {
      if (orderItem.menuItemItem && orderItem.menuItemItem.image) {
        orderItem.menuItemItem.image = Buffer.from(
          orderItem.menuItemItem.image
        ).toString("base64");
      }
      return orderItem;
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("order.fetched"),
      data: orderData,
    });
  } catch (error: unknown) {
    logger.error(
      `Error fetching order by ID: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const getAllOrders = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Fetch all orders
    const orders = await Order.findAll({
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          include: [
            {
              model: Item,
              as: "menuItemItem", // Ensure this matches the alias in the OrderItem -> Item association
              attributes: ["id", "name"], // Fetch item name and ID
            },
          ],
        },
        {
          model: Payment,
          as: "payment",
          attributes: ["id", "amount", "status", "paymentMethod"], // Fetch necessary payment fields
        },
      ],
      order: [["createdAt", "DESC"]], // Sort by most recent orders
    });

    if (!orders || orders.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage("order.noOrdersFound"),
      });
    }

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("order.allOrdersFetched"),
      data: orders,
    });
  } catch (error: unknown) {
    logger.error(
      `Error fetching all orders: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const getTodaysOrders = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const canteenId = req.params.canteenId; // Extract canteenId from the request parameters
    // const { canteenId } = req.user as unknown as { canteenId: string }; // Extract canteenId from the token
    console.log("canteenId", canteenId);
    if (!canteenId) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage("validation.validationError"),
        errors: ["Canteen ID is required"],
      });
    }

    // Get today's date range
    const startOfDay = moment().startOf("day").toDate();
    const endOfDay = moment().endOf("day").toDate();

    // Fetch today's orders for the specified canteen
    const orders = await Order.findAll({
      where: {
        status: "placed",
        canteenId,
        orderDate: {
          [Op.between]: [startOfDay, endOfDay], // Filter orders created today
        },
      },
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          include: [
            {
              model: Item,
              as: "menuItemItem", // Ensure this matches the alias in the OrderItem -> Item association
              attributes: ["id", "name"], // Fetch item name and ID
            },
          ],
        },
        {
          model: Payment,
          as: "payment",
          attributes: ["id", "amount", "status", "paymentMethod"], // Fetch necessary payment fields
        },
      ],
      order: [["createdAt", "DESC"]], // Sort by most recent orders
    });

    console.log("canteenIdu", orders);


    if (!orders || orders.length === 0) {
      return res.status(statusCodes.SUCCESS).json({
        data: [],
        message: getMessage("order.noOrdersFound"),
      });
    }

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("order.todaysOrdersFetched"),
      data: orders,
    });
  } catch (error: unknown) {

    logger.error(
      `Error fetching today's orders: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const getOrdersSummary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Fetch total orders count and total amount

    const result = await Order.findAll({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "totalOrders"], // Count total orders
        [sequelize.fn("SUM", sequelize.col("totalAmount")), "totalAmount"], // Sum total amount
      ],
      where: { status: "placed" }, // Filter by status 'placed'
    });

    const summary = result[0]?.toJSON();

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("order.summaryFetched"),
      data: summary,
    });
  } catch (error: unknown) {
    logger.error(
      `Error fetching orders summary: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const getOrdersByCanteen = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Fetch total orders and total amount grouped by canteen name
    const result = await Order.findAll({
      attributes: [
        [sequelize.col("Canteen.canteenName"), "canteenName"], // Use the correct column name
        [sequelize.fn("COUNT", sequelize.col("Order.id")), "totalOrders"], // Count total orders
        [
          sequelize.fn("SUM", sequelize.col("Order.totalAmount")),
          "totalAmount",
        ], // Sum total amount
      ],
      include: [
        {
          model: Canteen, // Ensure the model is correctly imported
          as: "Canteen", // Alias must match the association
          attributes: [], // Exclude additional Canteen attributes
        },
      ],
      group: ["Canteen.canteenName"], // Group by the correct column name
      where: { status: "placed" }, // Filter by status 'placed'
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("order.canteenSummaryFetched"),
      data: result,
    });
  } catch (error: unknown) {
    logger.error(
      `Error fetching orders by canteen: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const processCashfreePayment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      orderId,
      amount,
      currency = "INR",
      customerName,
      customerEmail,
      customerPhone,
    } = req.body;

    // Validate required fields
    if (
      !orderId ||
      !amount ||
      !customerName ||
      !customerEmail ||
      !customerPhone
    ) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage("validation.validationError"),
        errors: [
          "orderId, amount, customerName, customerEmail, and customerPhone are required",
        ],
      });
    }

    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL =
      process.env.CASHFREE_BASE_URL || "https://sandbox.cashfree.com/pg";

    // console.log("CASHFREE_APP_ID", CASHFREE_APP_ID);
    // console.log("CASHFREE_SECRET_KEY", CASHFREE_SECRET_KEY);

    // console.log("CASHFREE_BASE_URL", CASHFREE_BASE_URL);

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Cashfree credentials are not configured",
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
    logger.info("Cashfree Headers:", {
      clientId: CASHFREE_APP_ID,
      clientSecret: CASHFREE_SECRET_KEY,
    });
    logger.info("Cashfree Payload:", payload);

    // Make API request to Cashfree to create an order
    const response = await axios.post(`${CASHFREE_BASE_URL}/orders`, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
      },
    });

    // Handle Cashfree response
    if (response.status === 200 && response.data) {
      const { cf_order_id, payment_session_id } = response.data;

      // Construct the payment link
      const paymentLink = `https://sandbox.cashfree.com/pg/orders/${cf_order_id}`;

      return res.status(statusCodes.SUCCESS).json({
        message: "Cashfree order created successfully",
        data: {
          orderId,
          paymentLink,
          paymentSessionId: payment_session_id,
        },
      });
    } else {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Failed to create Cashfree order",
        data: response.data,
      });
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      logger.error("Cashfree Error Response:", error.response?.data);
    }
    logger.error(
      `Error processing Cashfree payment: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const cashfreeCallback = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Get parameters from either query params (GET) or request body (POST)
    const order_id =
      req.method === "GET" ? req.query.order_id : req.body.order_id;
    const payment_status =
      req.method === "GET" ? req.query.payment_status : req.body.payment_status;
    const payment_amount =
      req.method === "GET" ? req.query.payment_amount : req.body.payment_amount;
    const payment_currency =
      req.method === "GET"
        ? req.query.payment_currency
        : req.body.payment_currency;
    const transaction_id =
      req.method === "GET" ? req.query.transaction_id : req.body.transaction_id;

    // console.log(
    //   order_id,
    //   payment_status,
    //   payment_amount,
    //   payment_currency,
    //   transaction_id
    // );

    // Return a placeholder response for now
    return res.status(statusCodes.SUCCESS).json({
      message: "Callback processed successfully",
      data: {
        order_id,
        payment_status,
        payment_amount,
        payment_currency,
        transaction_id,
      },
    });
  } catch (error: unknown) {
    logger.error(
      `Error processing Cashfree callback: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const createPaymentLink = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      orderId,
      amount,
      currency = "INR",
      customerName,
      customerEmail,
      customerPhone,
    } = req.body;

    // Validate required fields
    if (
      !orderId ||
      !amount ||
      !customerName ||
      !customerEmail ||
      !customerPhone
    ) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage("validation.validationError"),
        errors: [
          "orderId, amount, customerName, customerEmail, and customerPhone are required",
        ],
      });
    }

    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL =
      process.env.CASHFREE_BASE_URL || "https://sandbox.cashfree.com/pg";

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Cashfree credentials are not configured",
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
    logger.info("Cashfree Headers:", {
      clientId: CASHFREE_APP_ID,
      clientSecret: CASHFREE_SECRET_KEY,
    });
    logger.info("Cashfree Payload:", payload);

    // Make API request to Cashfree to create an order
    const response = await axios.post(`${CASHFREE_BASE_URL}/orders`, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
      },
    });

    // Handle Cashfree response
    if (response.status === 200 && response.data) {
      const { cf_order_id, payment_session_id } = response.data;

      // Construct the payment link
      const paymentLink = `${CASHFREE_BASE_URL}/orders/${cf_order_id}`;

      return res.status(statusCodes.SUCCESS).json({
        message: "Cashfree payment link created successfully",
        data: {
          orderId,
          paymentLink,
          paymentSessionId: payment_session_id,
        },
      });
    } else {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Failed to create Cashfree payment link",
        data: response.data,
      });
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      logger.error("Cashfree Error Response:", error.response?.data);
    }
    logger.error(
      `Error creating Cashfree payment link: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const createCashfreePaymentLink = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      linkId,
      amount,
      currency = "INR",
      customerName,
      customerEmail,
      customerPhone,
      description,
    } = req.body;

    // Validate required fields
    if (
      !linkId ||
      !amount ||
      !customerName ||
      !customerEmail ||
      !customerPhone
    ) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage("validation.validationError"),
        errors: [
          "linkId, amount, customerName, customerEmail, and customerPhone are required",
        ],
      });
    }

    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL =
      process.env.CASHFREE_BASE_URL || "https://sandbox.cashfree.com/pg";

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Cashfree credentials are not configured",
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
      link_purpose: description || "Payment Link",
    };

    // Log headers and payload for debugging
    logger.info("Cashfree Headers:", {
      clientId: CASHFREE_APP_ID,
      clientSecret: CASHFREE_SECRET_KEY,
    });
    logger.info("Cashfree Payload:", payload);

    // Make API request to Cashfree to create a payment link
    const response = await axios.post(`${CASHFREE_BASE_URL}/links`, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
      },
    });

    // Handle Cashfree response
    if (response.status === 200 && response.data) {
      const { link_id, link_url } = response.data;

      return res.status(statusCodes.SUCCESS).json({
        message: "Cashfree payment link created successfully",
        data: {
          linkId: link_id,
          paymentLink: link_url,
        },
      });
    } else {
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Failed to create Cashfree payment link",
        data: response.data,
      });
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      logger.error("Cashfree Error Response:", error.response?.data);
    }
    logger.error(
      `Error creating Cashfree payment link: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const CashfreePaymentLinkDetails = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const transaction = await sequelize.transaction(); // Start a transaction

  try {
    const { linkId } = req.body; // Extract linkId from the request body
    // console.log("linkId", linkId);
    if (!linkId) {
      await transaction.rollback(); // Rollback if no linkId provided
      return res.status(400).json({
        message: "linkId is required to fetch payment details.",
      });
    }

    // Extract the numeric part from the linkId
    const numericPart = linkId.split("_").pop(); // Extracts the part after the last underscore
    // console.log("numericPart", numericPart);

    if (!numericPart || isNaN(Number(numericPart))) {
      await transaction.rollback(); // Rollback if linkId format is invalid
      return res.status(400).json({
        message:
          "Invalid linkId format. Expected format: testcash_link_<number>",
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

    let sendWhatsAppMessage = true;
    // console.log("payment status", payment.status);
    if (payment.status === "success") {
      sendWhatsAppMessage = false; // Don't send WhatsApp message if payment is already successful

      await transaction.commit(); // Commit the transaction here since we're returning early

      let orderdetails = await Order.findOne({
        where: { id: payment.orderId },
      });

      if (orderdetails && orderdetails.status === "initiated") {
        orderdetails.status = "placed";
        await orderdetails.save({ transaction });
      }

      // console.log("orderdetails", orderdetails?.status);

      return res.status(200).json({
        message: "Payment already successful.",
        data: {
          payment,
          orderdetails,
        },
      });
    }

    // console.log("Fetching payment details from Cashfree for linkId:", linkId);
    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL =
      process.env.CASHFREE_BASE_URL || "https://sandbox.cashfree.com/pg";

    // Make an API call to Cashfree to fetch payment details using the linkId
    const response = await axios.get(`${CASHFREE_BASE_URL}/links/${linkId}`, {
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
      },
    });

    // Handle Cashfree response
    // console.log("response", response.data);
    // console.log("response status", response.status);
    if (response.status === 200 && response.data) {
      const paymentDetails = response.data;

      // console.log("paymentDetails", paymentDetails.link_status);
      // Update the payment record in the database
      await payment.update(
        {
          status: paymentDetails.link_status === "PAID" ? "success" : "pending",
          transactionId: paymentDetails.transaction_id || payment.transactionId,
          updatedAt: new Date(),
        },
        { transaction }
      );

      // Update the order status based on payment success
      // console.log("paymentDetails.link_status ",paymentDetails.link_status)
      if (paymentDetails.link_status === "PAID") {
        const order = await Order.findByPk(payment.orderId, { transaction });
        // console.log("order ",order)

        if (order) {
          // console.log("order status ",order.status)
          order.status = "placed";
          // First, check if we need to generate a QR code
          if (order.qrCode === null || order.qrCode === undefined) {
            const qrCodeData = `${process.env.BASE_URL}/api/order/${order.id}`;
            const qrCode = await QRCode.toDataURL(qrCodeData);
            order.qrCode = qrCode; // Generate and set the QR code if it's not already set
          }

          // Save the order first
          await Order.update(
            {
              status: "placed",
              qrCode: order.qrCode
            },
            {
              where: { id: order.id },
              transaction
            }
          );

          // Now handle WhatsApp message if needed, regardless of whether QR was just generated
          if (sendWhatsAppMessage) {
            try {
              const { filePath } = await generateOrderQRCode(order, transaction);
              if (filePath) {
                let whatsappuploadedid = await uploadImageToAirtelAPI(filePath);
                console.log("whatsappuploadedid", whatsappuploadedid);
                await sendWhatsQrAppMessage(order, whatsappuploadedid);
              }
            } catch (whatsappError) {
              // Log the error but don't fail the transaction
              console.error("Error sending WhatsApp message:", whatsappError);
            }
          }
        }
      }

      // Commit the transaction
      await transaction.commit();

      // Return the updated payment details as a response
      console.log("Payment details updated successfully:", payment.orderId);
      const orderdetails = await Order.findOne({
        where: { id: payment.orderId },
      });

      return res.status(200).json({
        message: "Payment details updated successfully.",
        data: {
          payment,
          cashfreeDetails: paymentDetails,
          orderdetails,
        },
      });
    } else {
      // Rollback the transaction if the API call fails
      await transaction.rollback();
      return res.status(400).json({
        message: "Failed to fetch payment details from Cashfree.",
        error: response.data,
      });
    }
  } catch (error: unknown) {
    await transaction.rollback(); // Rollback the transaction in case of any error
    console.error(
      "Error fetching or updating payment details from Cashfree:",
      error
    );
    return res.status(500).json({
      message:
        "An error occurred while fetching or updating payment details from Cashfree.",
      error: error instanceof Error ? error.message : String(error),
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

const sendWhatsQrAppMessage = async (order: any, whatsappuploadedid: any | null): Promise<void> => {
  const userId = order.userId; // Extract userId from the order object
  const user: any = await User.findOne({ where: { id: userId } }); // Fetch user details from the User table
  const phoneNumber = user?.mobile; // Get the phone number from the user details

  const name =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : "User"; // Default to 'User' if name doesn't exist

  let OrderNo = "NV".concat(order.id.toString());
  let toNumber = "91".concat(phoneNumber);

  if (whatsappuploadedid) {

    /// sendOrderSMS
    let smsresult = await sendOrderSMS(phoneNumber, order.orderNo, name);
    console.log("smsresult", smsresult);

    sendImageWithoutAttachment(
      toNumber,
      "01jxc2n4fawcmzwpewsx7024wg",
      [name,],
      [],
      whatsappuploadedid
    );

  } else {

    sendImageWithoutAttachment(
      toNumber,
      "01jxc2n4fawcmzwpewsx7024wg",
      [name, OrderNo],
      [],
      whatsappuploadedid
    );

  }


  // const url = 'https://iqwhatsapp.airtel.in/gateway/airtel-xchange/basic/whatsapp-manager/v1/session/send/media';
  // const username = 'world_tek';
  // const password = 'T7W9&w3396Y"'; // Replace with actual password

  // const auth = Buffer.from(`${username}:${password}`).toString('base64');

  // const payload = {
  //   sessionId: generateUuid(),
  //   to: "91".concat(phoneNumber), // Recipient number
  //   from: "918686078782", // Dynamically set the sender number
  //   message: {
  //     text: 'Your Order is Placed', // Message text
  //   },
  //   mediaAttachment: {
  //       "type": "IMAGE",
  //       "id": "https://welfarecanteen.in/public/Naval.jpg"
  //   }
  // };
  // console.log('WhatsApp Payload:', payload);
  // console.log('WhatsApp URL:', url);
  // try {
  //   const response = await axios.post(url, payload, {
  //     headers: {
  //       Authorization: `Basic ${auth}`,
  //       'Content-Type': 'application/json',
  //     },
  //   });

  //    console.log('Message sent successfully:', response.data);
  // } catch (error: any) {
  //   console.error('Error sending message:', error.response?.data || error.message);
  //   throw error;
  // }
};

export const cancelOrder = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const transaction = await sequelize.transaction(); // Start a transaction

  try {
    const { orderId } = req.body; // Extract orderId from the request body
    console.log("orderId", orderId);
    if (!orderId) {
      return res.status(400).json({
        message: "Order ID is required to cancel the order.",
      });
    }

    // Fetch the order by ID
    const order: any = await Order.findOne({
      where: { id: orderId, status: "placed" }, // Ensure the order is in 'placed' status
      include: [
        {
          model: Payment,
          as: "payment", // Ensure this matches the alias in the Order -> Payment association
        },
      ],
      transaction, // Use the transaction
    });

    if (!order) {
      console.log("No valid order found with ID:", orderId);
      await transaction.rollback(); // Rollback the transaction if no valid order is found
      return res.status(404).json({
        message: "No valid order found with the provided ID.",
      });
    }

    // Update the order status to 'canceled'
    order.status = "canceled";
    await Order.update(
      { status: "canceled" },
      {
        where: { id: order.id },
        transaction
      }
    );

    // Process all associated payments using map
    const payments = order.payment; // Fetch all payments associated with the order
    let totalRefundAmount = 0;
    console.log("payments", payments.length);
    await Promise.all(
      payments.map(async (payment: any) => {
        console.log("Processing refund for payment ID:", payment.id);

        console.log("Processing payment ID:", payment.status);
        if (payment.status === "success") {
          totalRefundAmount += payment.amount;
          console.log("Refund amount:", payment.amount);
          console.log("Payment method:", payment.paymentMethod);
          // Handle wallet payment refund
          if (
            payment.paymentMethod === "wallet" ||
            payment.paymentMethod === "online" ||  payment.paymentMethod === "cash"
          ) {
            await Wallet.create(
              {
                userId: order.userId, // Assuming `userId` is available in the order
                referenceId: orderId, // Use the orderId as the referenceId
                type: "credit", // Indicate this is a credit transaction
                amount: payment.amount, // Refund the payment amount
                createdAt: Math.floor(Date.now() / 1000), // Store as Unix timestamp
                updatedAt: Math.floor(Date.now() / 1000), // Store as Unix timestamp
              },
              { transaction }
            );
          }

          // Update the payment status to 'refunded'
          payment.status = "refunded";
          await Payment.update(
            { status: "refunded" },
            {
              where: { id: payment.id },
              transaction
            }
          );
        }
      })
    );

    // Commit the transaction
    await transaction.commit();

    return res.status(200).json({
      message:
        "Order canceled successfully. Refund processed for all payments.",
      data: {
        orderId: order.id,
        orderStatus: order.status,
        totalRefundAmount,
      },
    });
  } catch (error: unknown) {
    await transaction.rollback(); // Rollback the transaction in case of any error
    console.error("Error canceling order:", error);
    return res.status(500).json({
      message: "An error occurred while canceling the order.",
    });
  }
};

export const getWalletTransactions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { userId } = req.user as unknown as { userId: string }; // Extract userId from the request

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required to fetch wallet transactions.",
      });
    }

    // Ensure userId is a string
    const userIdString = String(userId);

    // Fetch wallet transactions for the user
    const transactions = await Wallet.findAll({
      where: { userId: userIdString }, // Ensure the type matches the database column
      order: [["createdAt", "DESC"]], // Sort by most recent transactions
    });

    if (!transactions || transactions.length === 0) {
      return res.status(200).json({
        message: "No wallet transactions found for this user.",
        data: {
          transactions: [],
          walletBalance: 0, // Return 0 balance if no transactions found
        },
      });
    }

    // Calculate the wallet balance for the user
    const creditSum = await Wallet.sum("amount", {
      where: { userId: userIdString, type: "credit" },
    });

    const debitSum = await Wallet.sum("amount", {
      where: { userId: userIdString, type: "debit" },
    });

    const walletBalance = (creditSum || 0) - (debitSum || 0); // Calculate the balance

    return res.status(200).json({
      message: "Wallet transactions fetched successfully.",
      data: {
        transactions,
        walletBalance, // Include the available balance in the response
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching wallet transactions:", error);
    return res.status(500).json({
      message: "An error occurred while fetching wallet transactions.",
    });
  }
};

export const getWalletBalance = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { userId } = req.user as unknown as { userId: string }; // Extract userId from the request

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required to fetch wallet balance.",
      });
    }

    // Ensure userId is a string
    const userIdString = String(userId);

    // Calculate the wallet balance for the user
    const creditSum = await Wallet.sum("amount", {
      where: { userId: userIdString, type: "credit" },
    });

    const debitSum = await Wallet.sum("amount", {
      where: { userId: userIdString, type: "debit" },
    });

    const walletBalance = (creditSum || 0) - (debitSum || 0); // Calculate the balance

    return res.status(200).json({
      message: "Wallet balance fetched successfully.",
      data: {
        userId: userIdString,
        walletBalance,
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching wallet balance:", error);
    return res.status(500).json({
      message: "An error occurred while fetching wallet balance.",
    });
  }
};

export async function generateUniqueOrderNo(userId: any, transaction: Transaction) {
  let orderNo: string;
  let isUnique = false;
  let attempts = 0;
  do {
    orderNo = `NV${userId}${moment().format("YYMMDDHHmmss")}`;
    // Check if orderNo already exists
    const existingOrder = await Order.findOne({
      where: { orderNo },
      transaction,
    });
    if (!existingOrder) {
      isUnique = true;
    } else {
      // Wait a short time before retrying to avoid tight loop
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    attempts++;
    if (attempts > 5) {
      await transaction.rollback();
      throw new Error(
        "Failed to generate a unique order number. Please try again."
      );
    }
  } while (!isUnique);
  return orderNo;
}

export const updateOrderStatus = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { orderIds } = req.body; // Extract orderIds from the request body

  // Start a transaction
  const transaction: Transaction = await sequelize.transaction();

  try {
    // Validate the payload
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      logger.error("Validation error: orderIds must be a non-empty array");
      await transaction.rollback(); // Rollback transaction
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage("validation.validationError"),
        errors: ["orderIds must be a non-empty array"],
      });
    }

    // Update the status of orders to 'completed'
    const [updatedCount] = await Order.update(
      { status: "completed" }, // Set status to 'completed'
      {
        where: { id: orderIds }, // Update orders with matching IDs
        transaction, // Use the transaction
      }
    );

    if (updatedCount === 0) {
      logger.warn(`No orders found for the provided IDs: ${orderIds}`);
      await transaction.rollback(); // Rollback transaction
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage("order.notFound"),
      });
    }

    // Commit the transaction
    await transaction.commit();

    logger.info(`Order statuses updated to 'completed' for IDs: ${orderIds}`);
    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("order.statusUpdated"),
      data: { updatedCount },
    });
  } catch (error: unknown) {
    // Rollback the transaction in case of an error
    await transaction.rollback();

    logger.error(
      `Error updating order statuses: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const createWalkinOrders = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const transaction: Transaction = await sequelize.transaction();

  try {
    // Extract canteenId from the user's token
    const { canteenId } = req.user as unknown as { canteenId: string };

    if (!canteenId) {
      await transaction.rollback();
      return res.status(statusCodes.BAD_REQUEST).json({
        message: "Canteen ID not found in authentication token",
      });
    }

    const walkinOrdersData = Array.isArray(req.body) ? req.body : [req.body];

    if (walkinOrdersData.length === 0) {
      await transaction.rollback();
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage("validation.validationError"),
        errors: ["Order data is required"],
      });
    }

    // Verify the canteen exists
    const canteen = await Canteen.findByPk(canteenId, { transaction });
    if (!canteen) {
      logger.warn(`Canteen not found for canteenId from token: ${canteenId}`);
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: "Canteen not found",
      });
    }

    const processedOrders = [];

    // Process each order in the array
    for (const walkinOrderData of walkinOrdersData) {
      // Validate required fields (no longer checking for menuId)
      if (!walkinOrderData.contactNumber) {
        continue; // Skip invalid orders
      }

      if (
        !walkinOrderData.orderItems ||
        !Array.isArray(walkinOrderData.orderItems) ||
        walkinOrderData.orderItems.length === 0
      ) {
        continue; // Skip orders without items
      }

      // Check if mobile number exists in the User table
      let user = await User.findOne({
        where: { mobile: walkinOrderData.contactNumber },
        transaction,
      });

      // If user doesn't exist, create a new account
      if (!user) {
        user = await User.create(
          {
            mobile: walkinOrderData.contactNumber,
            firstName: walkinOrderData.customerName || "Guest",
            lastName: "User",
            email: null,
          },
          { transaction }
        );

        logger.info(
          `Created new user with mobile: ${walkinOrderData.contactNumber}`
        );
      }

      // Generate a unique order number
      const orderNo = await generateUniqueOrderNo(user.id, transaction);

      // Create the order using canteenId from token
      const order = await Order.create(
        {
          userId: user.id,
          totalAmount: walkinOrderData.totalAmount,
          status: "completed",
          canteenId: canteenId, // Use canteenId from token
          menuConfigurationId: walkinOrderData.menuConfigurationId || canteenId, // Fallback to canteenId
          createdById: user.id,
          orderDate: Math.floor(Date.now() / 1000),
          orderNo,
          notes: walkinOrderData.notes || "",
        },
        { transaction }
      );

      // Generate QR Code
      const qrCodeData = `${process.env.BASE_URL}/api/order/${order.id}`;
      const qrCode = await QRCode.toDataURL(qrCodeData);

      // Update the order with the QR code
      order.qrCode = qrCode;
      await order.save({ transaction });

      // Process order items
      const orderItems = [];
      for (const item of walkinOrderData.orderItems) {
        // Verify the item exists
        const menuItem = await Item.findByPk(item.menuItemId, { transaction });
        if (!menuItem) {
          logger.warn(`Menu item not found: ${item.menuItemId}`);
          continue; // Skip this item
        }

        orderItems.push({
          orderId: order.id,
          itemId: item.menuItemId,
          quantity: item.quantity,
          price: item.unitPrice,
          total: item.totalPrice,
          createdById: user.id,
        });
      }

      if (orderItems.length > 0) {
        await OrderItem.bulkCreate(orderItems, { transaction });
      }

      // Create payment record
      const payment = await Payment.create(
        {
          orderId: order.id,
          userId: user.id,
          createdById: user.id,
          paymentMethod: walkinOrderData.paymentMethod.toLowerCase(),
          transactionId: null,
          amount: walkinOrderData.totalAmount,
          totalAmount:
            walkinOrderData.finalAmount || walkinOrderData.totalAmount,
          status: "completed",
          gatewayCharges: 0,
          gatewayPercentage: 0,
          currency: "INR",
        },
        { transaction }
      );

      processedOrders.push({
        order,
        qrCode,
        userId: user.id,
      });
    }

    // Commit the transaction only if we have processed at least one order
    if (processedOrders.length > 0) {
      await transaction.commit();

      return res.status(statusCodes.SUCCESS).json({
        message: getMessage("order.placed"),
        data: {
          orders: processedOrders,
          processedCount: processedOrders.length,
          totalCount: walkinOrdersData.length,
        },
      });
    } else {
      await transaction.rollback();
      return res.status(statusCodes.BAD_REQUEST).json({
        message: "No valid orders to process",
      });
    }
  } catch (error: unknown) {
    await transaction.rollback();
    logger.error(
      `Error creating walkin orders: ${error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};



/**
 * Generates a QR code for an order and saves it both as a PNG file and base64 string
 * @param order - The order object that needs a QR code
 * @param transaction - Optional Sequelize transaction
 * @returns Object with the base64 string and file path
 */
export const generateOrderQRCode = async (order: any, transaction?: any): Promise<{ base64: string, filePath: string }> => {
  try {
    // Create QR code data URL with order details
    const qrCodeData = `${process.env.BASE_URL}/api/order/${order.id}`;

    // Create a unique filename for the QR code
    const qrCodeFileName = `order_${order.OrderNo}_${Date.now()}.png`;

    // Ensure upload directory exists
    const uploadDir = path.join(__dirname, '../../upload');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      // console.log(`Created directory: ${uploadDir}`);
    }

    const qrCodeFilePath = path.join(uploadDir, qrCodeFileName);

    // Configure QR code options for high quality
    const qrCodeOptions = {
      errorCorrectionLevel: 'H' as const, // High error correction for better scanning
      width: 300, // QR code width in pixels
      margin: 1,
      color: {
        dark: '#000000',  // Black dots
        light: '#FFFFFF'  // White background
      }
    };

    // Generate QR code as base64 for database storage
    const qrCodeBase64 = await QRCode.toDataURL(qrCodeData, qrCodeOptions);

    // Save to file system - the PNG format is automatically determined from the file extension
    await QRCode.toFile(qrCodeFilePath, qrCodeData, qrCodeOptions);



    // Update the order with the QR code if transaction is provided
    if (transaction && order) {
      order.qrCode = qrCodeBase64;
      order.qrCodeFilePath = qrCodeFilePath;
      // await order.save({ transaction });
    }

    // console.log(`QR code saved to file: ${qrCodeFilePath}`);

    return {
      base64: qrCodeBase64,
      filePath: qrCodeFilePath
    };
  } catch (error) {
    console.error(`Error generating QR code: ${error}`);
    throw error;
  }
};
