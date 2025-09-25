import crypto from "crypto";
import jwt from "jsonwebtoken";
import moment from "moment-timezone";
import { messages } from "./messages";
import dotenv from "dotenv";
import axios from "axios";
import User from "../models/user";
import userRole from "../models/userRole";
import UserRole from "../models/userRole";
import Role from "../models/role";
import OrderItem from "../models/orderItem";
import  Item from "../models/item";

import { Op } from "sequelize";
import Order from "../models/order";
// const { OrderItem } = require("../models/orderItem"); // Adjust import as needed
// const Item = require("../models/item"); // Adjust import as needed

dotenv.config();

/**
 * Generates a 6-digit OTP.
 * @returns The generated OTP as a string.
 */
export const generateOtp = (): string => {
  return crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
};


/**
 * Checks if an order already exists for the given user, date, and menu configuration.
 * Rolls back the transaction and sends a response if an order exists.
 */
export const getTotalItemsPlacedOnDate = async (
  orderDate: string,
  itemId: number
): Promise<{ remainingQuantity: number }> => {

  const orderDateUnix = moment(orderDate, "DD-MM-YYYY").unix();

  // Count total items placed on the given date
  // Validate the date format first
  if (!moment(orderDate, "DD-MM-YYYY").isValid()) {
    throw new Error("Invalid date format. Expected DD-MM-YYYY");
  }

  // const totalItems = await OrderItem.count({
  //   where: {
  //     itemId: itemId, // Match with the specific itemId
    
  //   },
  //   include: [
  //     {
  //       model: Order,
  //       as: "order",
  //       where: {
  //         status: {
  //           [Op.in]: ["placed", "completed"],
  //         },
  //         orderDate: orderDateUnix // Added date check at Order level
  //       },
  //     },
  //   ],
  // });


// Find all order IDs that match the date and status criteria
const matchingOrders = await Order.findAll({
  where: {
    status: {
      [Op.in]: ['placed', 'completed'],
    },
    orderDate: orderDateUnix,
  },
  attributes: ['id'],
});

const matchingOrderIds = matchingOrders.map((order: any) => order.id);

const totalItems = (await OrderItem.sum('quantity', {
  where: {
    itemId: itemId,
    orderId: {
      [Op.in]: matchingOrderIds.length > 0 ? matchingOrderIds : [0], // [0] ensures no match if empty
    },
  },
})) || 0; // fallback to 0 if null





  // Fetch the quantity from the Item table for the given itemId
  const item = await Item.findOne({
    where: { id: itemId },
    attributes: ["quantity"],
  });

console.log("totalItems Details:", totalItems);
  const quantity = item ? item.quantity : 0;
console.log("Item Stock Quantity:", quantity);
  let remainingQuantity = quantity - totalItems;

  console.log("Remaining Quantity:", remainingQuantity);

  return { remainingQuantity };

};




export const checkexistingorder = async (
  orderDate: string,
  userId: number,
  menuConfigurationId: number,
  transaction: any,
  res: any
): Promise<any> => {
  const checkOrderDateUnix = moment(orderDate, "DD-MM-YYYY").unix();

  const existingOrder = await Order.findOne({
    where: {
      userId,
      orderDate: checkOrderDateUnix,
      menuConfigurationId,
      status: {
        [Op.in]: ["placed", "completed"],
      },
    },
    transaction,
  });

  if (existingOrder) {
    return false;
  }
  return true;
};



export const getCustomerProfile = async (mobile: string): Promise<any> => {
  try {
    const user = await User.findOne({
      where: { mobile },
      include: [
        {
          model: UserRole, // Include the UserRole table
          as: "userRoles", // Ensure this matches the alias in the association
          include: [
            {
              model: Role, // Include the Role table
              as: "role", // Ensure this matches the alias in the association
              attributes: ["id", "name"], // Fetch only necessary fields
            },
          ],
          attributes: ["roleId"], // Fetch only the roleId field from UserRole
        },
      ],
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  } catch (error) {
    console.error("Error fetching customer profile:", error);
    throw new Error("Failed to fetch customer profile");
  }
};

export const getCustomerDetails = async (userId: number): Promise<any> => {
  try {
    const user = await User.findOne({
      where: { id: userId },
      include: [
        {
          model: UserRole, // Include the UserRole table
          as: "userRoles", // Ensure this matches the alias in the association
          include: [
            {
              model: Role, // Include the Role table
              as: "role", // Ensure this matches the alias in the association
              attributes: ["id", "name"], // Fetch only necessary fields
            },
          ],
          attributes: ["roleId"], // Fetch only the roleId field from UserRole
        },
      ],
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  } catch (error) {
    console.error("Error fetching customer profile:", error);
    throw new Error("Failed to fetch customer profile");
  }
};

export const generateToken = (
  payload: object,
  expiresIn: string = "365d"
): string => {
  const secret = process.env.JWT_SECRET || "default_secret_for_dev";
  if (!process.env.JWT_SECRET) {
    console.warn(
      "Warning: JWT_SECRET is not defined. Using fallback secret for development."
    );
  }

  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
};

/**
 * Get the expiry time in Unix timestamp for a given duration in seconds.
 * @param durationInSeconds - The duration in seconds to add to the current time.
 * @returns The expiry time as a Unix timestamp in the Kolkata timezone.
 */
export const getExpiryTimeInKolkata = (durationInSeconds: number): number => {
  return moment.tz("Asia/Kolkata").add(durationInSeconds, "seconds").unix();
};

/**
 * Get a message in the configured language.
 * @param key - The key of the message (e.g., "validation.mobileRequired").
 * @returns The message in the configured language.
 */
export const getMessage = (key: string): string => {
  const language = process.env.LANGUAGE || "EN"; // Default to English
  const keys = key.split(".");
  let message: any = messages[language as keyof typeof messages];

  for (const k of keys) {
    if (message[k]) {
      message = message[k];
    } else {
      return "Message not found";
    }
  }

  return message;
};

export const sendOTPSMS = async (mobile: string, OTP: string): Promise<any> => {
  const template =
    "Dear {#var#} Kindly use this otp {#var#} for login to your Application . thank you Wecann";

  // Function to populate the template with dynamic values
  function populateTemplate(template: string, values: string[]): string {
    let index = 0;
    return template.replace(/{#var#}/g, () => values[index++]);
  }

  // Populate the template with the user's name and OTP
  const name = "user"; // Default name for the user
  const message = populateTemplate(template, [name, OTP]);

  // Example Output: Dear User, kindly use this OTP 123456 for login to your application. Thank you, Wecann.

  const templateid = "1707163101087015490";

  try {
    const params = {
      username: "WECANN",
      apikey: process.env.SMSAPIKEY, // Use API key from environment variables
      senderid: "WECANN",
      mobile: mobile,
      message: message,
      templateid: templateid,
    };

    // Call the sendSMS function
    return await sendSMS(params);
  } catch (error) {
    console.error("Error sending OTP SMS:", error);
    throw new Error("Failed to send OTP SMS");
  }
};

export const sendOrderSMS = async (mobile: string, orderno: string,name:string): Promise<any> => {
  const template =
    "Dear {#var#} Thank you For choosing Order Is {#var#} WIth Wecann have a great day .";

  // Function to populate the template with dynamic values
  function populateTemplate(template: string, values: string[]): string {
    let index = 0;
    return template.replace(/{#var#}/g, () => values[index++]);
  }

  // Populate the template with the user's name and OTP
  const message = populateTemplate(template, [name, orderno]);

  // Example Output: Dear User, kindly use this OTP 123456 for login to your application. Thank you, Wecann.

  const templateid = "1707163101096063708";

  try {
    const params = {
      username: "WECANN",
      apikey: process.env.SMSAPIKEY, // Use API key from environment variables
      senderid: "WECANN",
      mobile: mobile,
      message: message,
      templateid: templateid,
    };

    // Call the sendSMS function
    return await sendSMS(params);
  } catch (error) {
    console.error("Error sending order SMS:", error);
    throw new Error("Failed to send order SMS");
  }
};

const sendSMS = async (params: any): Promise<any> => {
  try {
    const url = "http://wecann.in/v3/api.php";

    // Trigger the API using axios
    const response = await axios.get(url, { params });

    return response.data; // Return the API response
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw new Error("Failed to send SMS");
  }
};


export const PaymentLink = async (
  order: any,
  payment: any,
  user: any
): Promise<Response> => {
  try {
    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL =
      process.env.CASHFREE_BASE_URL || "https://sandbox.cashfree.com/pg";

    // Create order payload for Cashfree

    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    let linkId = `live_${day}${month}${year}_`;

    linkId = linkId.concat(payment.id);
    const payload = {
      link_id: linkId,
      link_amount: payment.totalAmount,
      link_currency: payment.currency,
      customer_details: {
        customer_name: user.firstName + " " + user.lastName,
        customer_email: user.email,
        customer_phone: user.mobile,
      },
      link_meta: {
        return_url: `${process.env.APPLICATION_URL}/paymentResponse?link_id=${linkId}`, // Include linkId in return_url
        notify_url: `${process.env.BASE_URL}/api/order/cashfreecallback`, // Add notify URL
      },
      link_notify: {
        send_sms: false,
        send_email: false,
        payment_received: false,
      },
      link_payment_methods: ["upi"], // Restrict payment methods to UPI only
      link_purpose: "Payment",
    };

    // const payload = {
    //   order_id: order.orderId,
    //   order_amount: order.amount,
    //   order_currency: payment.currency,
    //   customer_details: {
    //     customer_id: order.userId, // Use orderId as customer_id for simplicity
    //     customer_name: user.firstName + " " + user.lastName,
    //     customer_email: user.email,
    //     customer_phone: user.phoneNumber,
    //   },
    //   order_meta: {
    //     return_url: `${process.env.BASE_URL}/api/order/cashfreecallback?order_id={order_id}`,
    //   },
    // };

    // Make API request to Cashfree to create an order
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

console.log("paymentresponse===================lool",response)
      // Construct the payment link
      const paymentLink = link_url;
      // Return the payment link as a response
      return paymentLink;
    } else {
      console.error("Error creating payment link:");
      // console.error(response.data);
      // console.error("Status code:", response.status);
      // Return an error response if the API call fails
      return new Response("Failed to create payment link", { status: 400 });
    }
  } catch (error: unknown) {
    console.error("Error creating payment link:", error);
    return new Response("Failed to create payment link", { status: 500 });
  }
};



export const getPaymentsByOrderId = async (orderId: string) => {
  try {
    const clientId = process.env.pgAppID;
    const clientSecret = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL =
      process.env.CASHFREE_BASE_URL || "https://sandbox.cashfree.com/pg";

    if (!orderId) {
      throw new Error("Order ID is required");
    }

    console.log(clientId, clientSecret, CASHFREE_BASE_URL, "envdata");

    const response = await axios.get(
      `${CASHFREE_BASE_URL}/orders/${orderId}/payments`,
      {
        headers: {
          "x-client-id": clientId,
          "x-client-secret": clientSecret,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json",
        },
      }
    );

    return response.data[0]; // ✅ return the data
  } catch (error: any) {
    console.error("Cashfree API Error:", error.response?.data || error.message);

    throw new Error(
      error.response?.data?.message || "Something went wrong while fetching payments"
    );
  }
};
