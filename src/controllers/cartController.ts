import { Request, Response } from 'express';
import Pricing from '../models/pricing';
import Item from '../models/item';

import CartItem from '../models/cartItem';
import Cart from '../models/cart';
import MenuConfiguration from '../models/menuConfiguration';
import Canteen from '../models/canteen';
import User from '../models/user';
import Order from '../models/order';
import OrderItem from '../models/orderItem';
import Payment from '../models/payment';
import MenuItem from '../models/menuItem';

import logger from '../common/logger';
import { statusCodes } from '../common/statusCodes';
import { getMessage } from '../common/utils';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import QRCode from 'qrcode';
import moment from 'moment-timezone'; // Import moment-timezone
moment.tz('Asia/Kolkata')
/**
 * Add an item to the user's cart with transaction support
 * Updated to include canteenId, menuConfigurationId, and orderDate
 */
export const addToCart = async (req: Request, res: Response): Promise<Response> => {
  const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });

  try {
    const { userId } = req.user as unknown as { userId: string }; // Extract userId from the request body
    const { itemId, quantity, menuId, canteenId, menuConfigurationId, orderDate } = req.body; // Include orderDate in the request body

    // Validate required fields
    if (!userId || !itemId || !quantity || !menuId || !canteenId || !menuConfigurationId || !orderDate) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['userId, itemId, quantity, menuId, canteenId, menuConfigurationId, and orderDate are required'],
      });
    }

    if (quantity <= 0) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['Quantity must be greater than 0'],
      });
    }

   // Convert orderDate to Unix timestamp
const formattedOrderDate = moment(orderDate, 'DD-MM-YYYY'); // Parse the orderDate in dd-mm-yyyy format
if (!formattedOrderDate.isValid()) {
  return res.status(statusCodes.BAD_REQUEST).json({
    message: getMessage('validation.invalidOrderDate'),
    errors: ['Invalid order date format. Expected format: DD-MM-YYYY'],
  });
}
const orderDateUnix = formattedOrderDate.unix(); // Convert to Unix timestamp


    // Verify the item exists in the menu and check its minimum and maximum quantity
    const menuItem: any = await MenuItem.findOne({
      where: { itemId, menuId },
      include: [
        {
          model: Item,
          as: 'menuItemItem', // Ensure this matches the alias in the MenuItem -> Item association
          include: [
            {
              model: Pricing,
              as: 'itemPricing', // Ensure this matches the alias in the Item -> Pricing association
            },
          ],
        },
      ],
      transaction,
    });

    if (!menuItem) {
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('menu.itemNotFound'),
      });
    }

    // Check for minimum and maximum quantity constraints
    if (quantity < menuItem.minQuantity) {
      await transaction.rollback();
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('menu.itemBelowMinQuantity'),
        errors: [`Minimum quantity for this item is ${menuItem.minQuantity}`],
      });
    }
    if (quantity > menuItem.maxQuantity) {
      await transaction.rollback();
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('menu.itemAboveMaxQuantity'),
        errors: [`Maximum quantity for this item is ${menuItem.maxQuantity}`],
      });
    }

    // Get or create the user's cart
    let [cart, created] = await Cart.findOrCreate({
      where: { userId, status: 'active' },
      defaults: {
        userId,
        status: 'active',
        totalAmount: 0,
        canteenId,
        menuConfigurationId,
        menuId,
        orderDate: orderDateUnix, // Add the order date as Unix timestamp
      },
      transaction,
    });

    if (!created && cart.canteenId !== canteenId) {
      await transaction.rollback();
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('cart.canteenMismatch'),
        errors: ['Items from different canteens cannot be added to the same cart'],
      });
    }

    // Calculate item price
    const price = menuItem.menuItemItem?.itemPricing?.price || 0;
    const itemTotal = price * quantity;

    // Check if the item already exists in the cart
    const existingCartItem:any = await CartItem.findOne({
      where: { cartId: cart.id, itemId, menuId },
      transaction,
    });

    if (existingCartItem) {
      existingCartItem.quantity += quantity;

      // Ensure the updated quantity does not exceed the maximum quantity
      if (existingCartItem.quantity > menuItem.maxQuantity) {
        await transaction.rollback();
        return res.status(statusCodes.BAD_REQUEST).json({
          message: getMessage('menu.itemAboveMaxQuantity'),
          errors: [`Maximum quantity for this item is ${menuItem.maxQuantity}`],
        });
      }

      existingCartItem.total = existingCartItem.quantity * price;
      existingCartItem.orderDate = orderDateUnix; // Update the order date as Unix timestamp
      await existingCartItem.save({ transaction });
    } else {
      await CartItem.create(
        {
          cartId: cart.id,
          itemId,
          menuId,
          quantity,
          price,
          total: itemTotal,
          canteenId,
          orderDate: orderDateUnix, // Add the order date as Unix timestamp
        },
        { transaction }
      );
    }

    // Update cart total
    const cartItems = await CartItem.findAll({ where: { cartId: cart.id }, transaction });
    cart.totalAmount = cartItems.reduce((sum, item) => sum + item.total, 0);
    await cart.save({ transaction });

    // Commit transaction
    await transaction.commit();

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('cart.itemAdded'),
      data: cart,
    });
  } catch (error: unknown) {
    await transaction.rollback();
    logger.error(`Error adding item to cart: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

/**
 * Update cart item quantity with transaction support
 */

export const updateCartItem = async (req: Request, res: Response): Promise<Response> => {
  const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });

  try {
    const { cartId, cartItemId, quantity } = req.body; // Extract values from the request body

    // Validate required fields
    if (!cartId || !cartItemId || !quantity) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['cartId, cartItemId, and quantity are required'],
      });
    }

    if (quantity <= 0) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['Quantity must be greater than 0'],
      });
    }

    // Verify the cart exists
    const cart = await Cart.findByPk(cartId, { transaction });
    if (!cart) {
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('cart.notFound'),
      });
    }

    // Verify the cart item exists and belongs to the specified cart
    const cartItem:any = await CartItem.findOne({
      where: { itemId: cartItemId, cartId }, // Ensure the cartItem belongs to the specified cart
      include: [
        {
          model: MenuItem,
          as: 'menuItem', // Ensure this matches the alias in the CartItem -> MenuItem association
          include: [{ model: Item, as: 'menuItemItem' }], // Ensure this matches the alias in the MenuItem -> Item association
        },
      ],
      transaction,
    });



    if (!cartItem) {
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('cart.itemNotFound'),
      });
    }

    // Check for minimum and maximum quantity constraints
    const menuItem = cartItem.menuItem;
    if (!menuItem) {
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('menu.itemNotFound'),
      });
    }

    if (quantity < menuItem.minQuantity) {
      await transaction.rollback();
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('menu.itemBelowMinQuantity'),
        errors: [`Minimum quantity for this item is ${menuItem.minQuantity}`],
      });
    }

    if (quantity > menuItem.maxQuantity) {
      await transaction.rollback();
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('menu.itemAboveMaxQuantity'),
        errors: [`Maximum quantity for this item is ${menuItem.maxQuantity}`],
      });
    }

    // Update the cart item
    cartItem.quantity = quantity;
    cartItem.total = cartItem.price * quantity;
    await cartItem.save({ transaction });

    // Update the cart total
    const cartItems = await CartItem.findAll({ where: { cartId }, transaction });
    cart.totalAmount = cartItems.reduce((sum, item) => sum + item.total, 0);
    await cart.save({ transaction });

    // Commit transaction
    await transaction.commit();

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('cart.itemUpdated'),
      data: cart,
    });
  } catch (error: unknown) {
    await transaction.rollback();
    logger.error(`Error updating cart item: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

/**
 * Remove item from cart with transaction support
 */


export const removeCartItem = async (req: Request, res: Response): Promise<Response> => {
  const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });

  try {
    const { cartId, cartItemId } = req.body; // Extract cartId and cartItemId from the request body

    // Validate required fields
    if (!cartId || !cartItemId) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['cartId and cartItemId are required'],
      });
    }

    // Verify the cart exists

    const cart = await Cart.findByPk(cartId, { transaction });
    if (!cart) {
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('cart.notFound'),
      });
    }

    // Verify the cart item exists and belongs to the specified cart
    const cartItem = await CartItem.findOne({
      where: {
        itemId: cartItemId, // Use itemId instead of itemid
        cartId: cartId,
      },
      transaction,
    });


    if (!cartItem) {
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('cart.itemNotFound'),
      });
    }

    // Remove the cart item
    await cartItem.destroy({ transaction });

    // Update the cart total
    const cartItems = await CartItem.findAll({ where: { cartId }, transaction });
    cart.totalAmount = cartItems.reduce((sum, item) => sum + item.total, 0);
    await cart.save({ transaction });


    // Commit transaction
    await transaction.commit();

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('cart.itemRemoved'),
      data: cart,
    });
  } catch (error: unknown) {
    await transaction.rollback();
    logger.error(`Error removing cart item: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};



/**
 * Get cart content for a user (No transaction needed for read-only operation)
 */


export const getCart = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.user as unknown as { userId: string }; // Extract userId from the request body
    if (!userId) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['userId is required'],
      });
    }

    const cart = await Cart.findOne({
      where: { userId, status: 'active' },
      include: [
        {
          model: CartItem,
          as: 'cartItems', // Ensure this matches the alias in the association
          include: [
            {
              model: Item,
              as: 'cartItemItem', // Ensure this matches the alias in the CartItem -> Item association
            },
          ],
        },
        {
          model: MenuConfiguration,
          as: 'cartMenuConfiguration', // Ensure this matches the alias in the Cart -> MenuConfiguration association
          attributes: ['id', 'name'], // Include only the necessary fields
        },
        
      ],
    });

    if (!cart) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('cart.notFound'),
      });
    }

    // Convert item images to Base64
    const cartData = cart.toJSON();
    cartData.cartItems = cartData.cartItems.map((cartItem: any) => {

      
      cartItem.item=cartItem.cartItemItem;
      delete cartItem.cartItemItem;
      if (cartItem.item && cartItem.item.image) {
        cartItem.item.image = Buffer.from(cartItem.item.image).toString('base64');
      }
      return cartItem;
    });

    cartData.MenuConfiguration=cartData.cartMenuConfiguration
    delete cartData.cartMenuConfiguration

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('cart.fetched'),
      data: cartData,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching cart: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};




/**
 * Clear cart with transaction support
 */



export const clearCart = async (req: Request, res: Response): Promise<Response> => {
  const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });

  try {
    const { userId } = req.user as unknown as { userId: string }; // Extract userId from the request body

    // Validate required fields
    if (!userId) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['userId is required'],
      });
    }

    // Find the active cart for the user
    console.log('Fetching active cart for userId:', userId);
    const cart = await Cart.findOne({ where: { userId, status: 'active' }, transaction });

    if (!cart) {
      console.log('No active cart found for userId:', userId);
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('cart.notFound'),
      });
    }

    // Clear all items in the cart
    console.log('Clearing all items in the cart with ID:', cart.id);
    await CartItem.destroy({ where: { cartId: cart.id }, transaction });

    // Remove the cart itself
    console.log('Removing the cart with ID:', cart.id);
    await cart.destroy({ transaction });

    // Commit the transaction
    console.log('Committing transaction for clearing cart with ID:', cart.id);
    await transaction.commit();

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('cart.cleared'),
    });
  } catch (error: unknown) {
    await transaction.rollback();
    logger.error(`Error clearing cart: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const createCart = async (req: Request, res: Response): Promise<Response> => {
  const transaction: Transaction = await sequelize.transaction();

  try {
    const { userId } = req.user as unknown as { userId: string };
    const { items } = req.body;

    if (!userId || !items || items.length === 0) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['User ID and items are required'],
      });
    }

    // Create a new cart for the user
    const cart = await Cart.create(
      {
        userId,
        status: 'active',
      },
      { transaction }
    );

    // Add items to the cart
    const cartItems = items.map((item: any) => ({
      cartId: cart.id,
      itemId: item.itemId,
      quantity: item.quantity,
      price: item.price,
      total: item.quantity * item.price,
    }));
    await CartItem.bulkCreate(cartItems, { transaction });

    // Commit the transaction
    await transaction.commit();

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('cart.created'),
      data: {
        cartId: cart.id,
        items: cartItems,
      },
    });
  } catch (error: unknown) {
    await transaction.rollback();
    logger.error(`Error creating cart: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const placeOrderWithMobile = async (req: Request, res: Response): Promise<Response> => {
  const transaction: Transaction = await sequelize.transaction();

  try {
    const { cartId, mobileNumber, paymentMethod, transactionId, currency = 'INR' } = req.body;

    if (!cartId || !mobileNumber || !paymentMethod) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
        errors: ['Cart ID, mobile number, and payment method are required'],
      });
    }

    // Check if a user exists with the provided mobile number
    let user = await User.findOne({ where: { mobileNumber }, transaction });

    // If user does not exist, create a new user account
    if (!user) {
      user = await User.create(
        {
          mobileNumber,
          name: `Guest_${mobileNumber}`, // Default name for the guest user
          password: null, // No password for guest accounts
        },
        { transaction }
      );
    }

    const userId = user.id;

    // Fetch the cart
    const cart: any = await Cart.findOne({
      where: { id: cartId, status: 'active' },
      include: [{ model: CartItem, as: 'cartItems' }],
      transaction,
    });

    if (!cart || !cart.cartItems || cart.cartItems.length === 0) {
      await transaction.rollback();
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('cart.empty'),
      });
    }

    const amount = cart.cartItems.reduce((sum: number, item: any) => sum + item.total, 0);
    const gatewayPercentage = 2.5;
    const gatewayCharges = (amount * gatewayPercentage) / 100;
    const totalAmount = amount + gatewayCharges;

    // Create the order
    const order = await Order.create(
      {
        userId,
        totalAmount: amount,
        status: 'placed',
        canteenId: null, // Set canteenId if applicable
        menuConfigurationId: null, // Set menuConfigurationId if applicable
        createdById: userId,
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
      createdById: userId,
    }));
    await OrderItem.bulkCreate(orderItems, { transaction });

    // Store payment details
    await Payment.create(
      {
        orderId: order.id,
        userId,
        paymentMethod,
        transactionId: transactionId || null,
        amount,
        gatewayPercentage,
        gatewayCharges,
        totalAmount,
        currency,
        status: 'success',
        createdById: userId,
      },
      { transaction }
    );

    // Clear the cart
    await CartItem.destroy({ where: { cartId: cart.id }, transaction });
    await cart.destroy({ transaction });

    // Commit the transaction
    await transaction.commit();

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('order.placed'),
      data: {
        order,
        payment: {
          paymentMethod,
          transactionId,
          amount,
          gatewayPercentage,
          gatewayCharges,
          totalAmount,
          currency,
        },
        qrCode,
      },
    });
  } catch (error: unknown) {
    await transaction.rollback();
    logger.error(`Error placing order with mobile: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};
