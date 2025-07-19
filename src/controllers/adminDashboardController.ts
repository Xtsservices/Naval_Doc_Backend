import { Request, Response } from 'express';
import logger from '../common/logger';
import { getMessage } from '../common/utils';
import { statusCodes } from '../common/statusCodes';
import { sequelize } from '../config/database'; // Import sequelize for transaction management
import { Op } from 'sequelize';
import { responseHandler } from '../common/responseHandler';
import Order from '../models/order';
import Item from '../models/item';
import Canteen from '../models/canteen';
import Menu from '../models/menu';
import OrderItem from '../models/orderItem'
import { User } from '../models';
import MenuItem from '../models/menuItem';
import MenuConfiguration from '../models/menuConfiguration';
import Pricing from '../models/pricing';
import moment from 'moment-timezone';


export const adminDashboard = async (req: Request, res: Response): Promise<Response> => {
  try {

    const { canteenId } = req.query; // Extract canteenId from query parameters
    // Add condition if canteenId is provided
    console.log("canteenId", canteenId)
    const whereCondition: any = {};
    if (canteenId) {
      whereCondition.canteenId = canteenId;
    }

    // Fetch total orders count and total amount
    const ordersSummary = await Order.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'], // Count total orders
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalAmount'], // Sum total amount
      ],
      where: { ...whereCondition, status: 'placed' }, // Filter by status 'placed' and canteenId if provided
    });

    const totalOrders = ordersSummary[0]?.toJSON()?.totalOrders || 0;
    const totalAmount = ordersSummary[0]?.toJSON()?.totalAmount || 0;

    // Fetch completed orders count
    const completedOrders = await Order.count({
      where: { ...whereCondition, status: 'completed' }, // Filter by status 'completed' and canteenId if provided
    });

    // Fetch cancelled orders count
    const cancelledOrders = await Order.count({
      where: { ...whereCondition, status: 'cancelled' }, // Filter by status 'cancelled' and canteenId if provided
    });

    // Fetch total items count
    const totalItems = await Item.count({
      where: { status: 'active' },
    });

    // Fetch total canteens count
    const totalCanteens = canteenId
      ? await Canteen.count({ where: { id: canteenId } }) // Count only the specified canteen if canteenId is provided
      : await Canteen.count();

    // Fetch total menus count
    const totalMenus = await Menu.count({
            where: { ...whereCondition, status: 'active' }, // Filter by status 'placed' and canteenId if provided

    });

    // Combine all data into a single response
    const dashboardSummary = {
      totalOrders,
      totalAmount,
      completedOrders,
      cancelledOrders,
      totalItems,
      totalCanteens,
      totalMenus,
    };

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('admin.dashboardFetched'),
      data: dashboardSummary,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching admin dashboard data: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getTotalMenus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { canteenId } = req.query; // Extract canteenId from query parameters

    const whereCondition = canteenId
      ? { canteenId, status: 'active' }
      : { status: 'active' }; // Add condition if canteenId is provided and status is 'active'
console.log("whereCondition",whereCondition)
    const totalMenus = await Menu.findAll({
      where: whereCondition, // Apply the condition to filter by canteenId
      include: [
        {
          model: Canteen, // Include the Canteen model
          as: 'canteenMenu', // Use the correct alias defined in the association
          attributes: ['id', 'canteenName'], // Fetch necessary canteen fields
        },
        {
          model: MenuConfiguration,
          as: 'menuMenuConfiguration', // Include menu configuration details
          attributes: ['id', 'name', 'defaultStartTime', 'defaultEndTime'], // Fetch necessary menu configuration fields
        },
        {
          model: MenuItem,
          where: { status: 'active' }, 
          as: 'menuItems', // Include menu items
          include: [
            {
              model: Item,
              as: 'menuItemItem', // Include item details
              attributes: ['id', 'name', 'description', 'image'], // Fetch necessary item fields
              include: [
                {
                  model: Pricing,
                  as: 'pricing', // Include pricing details
                  attributes: ['id', 'price', 'currency'], // Fetch necessary pricing fields
                },
              ],
            },
          ],
        },
      ],
      attributes: ['id', 'name', 'createdAt', 'updatedAt'], // Fetch necessary menu fields
    });

    

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('admin.totalMenusFetched'),
      data: totalMenus,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching total menus: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getTotalCanteens = async (req: Request, res: Response): Promise<Response> => {
  try {
    const totalCanteens = await Canteen.findAll({
      attributes: ['id', 'canteenName',  'canteenImage','canteenCode'], // Include the image field
    });

    // Convert image data to Base64
    const canteensWithBase64Images = totalCanteens.map((canteen) => {
      const canteenData = canteen.toJSON();
      if (canteenData.canteenImage) {
        canteenData.canteenImage = Buffer.from(canteenData.canteenImage).toString('base64'); // Convert image to Base64
      }
      return canteenData;
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('admin.totalCanteensFetched'),
      data: canteensWithBase64Images,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching total canteens: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getTotalItems = async (req: Request, res: Response): Promise<Response> => {
  try {
    const totalItems = await Item.findAll({
      where: { status: 'active' }, // Add condition for status 'active'
      attributes: ['id', 'name', 'description', 'image'], // Include the image field
    });

    // Convert image data to Base64
    const itemsWithBase64Images = totalItems.map((item) => {
      const itemData = item.toJSON();
      if (itemData.image) {
        itemData.image = Buffer.from(itemData.image).toString('base64'); // Convert image to Base64
      }
      return itemData;
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('admin.totalItemsFetched'),
      data: itemsWithBase64Images,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching total items: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};


export const getTotalOrders = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { canteenId, status, orderDate } = req.query;

    const whereCondition: any = {};
    if (canteenId) whereCondition.canteenId = canteenId;
    if (status && status !== 'all') whereCondition.status = status;

    // ✅ Exact date match (based on orderDate column which is Unix timestamp)
    if (orderDate && typeof orderDate === 'string') {
      const parsedDate = moment.tz(orderDate, 'YYYY/MM/DD', 'Asia/Kolkata');
      const dateUnix = parsedDate.startOf('day').unix(); // Only date part
      whereCondition.orderDate = dateUnix;
    }

    const totalOrders = await Order.findAll({
      where: whereCondition,
      include: [
        {
          model: Canteen,
          as: 'orderCanteen',
          attributes: ['id', 'canteenName'],
        },
        {
          model: OrderItem,
          as: 'orderItems',
          attributes: ['id', 'quantity', 'price', 'total', 'itemId'],
          include: [
            {
              model: Item,
              as: 'menuItemItem',
              attributes: [
                'id',
                'name',
                'description',
                'type',
                'status',
                'quantity',
                'quantityUnit',
              ],
            },
          ],
        },
      ],
      attributes: [
        'id',
        'orderDate',
        'orderNo',
        'totalAmount',
        'status',
        'canteenId',
        'menuConfigurationId',
        'createdAt',
        'updatedAt',
      ],
      raw: false,
      nest: true,
    });

    // Attach menuName based on canteenId and menuConfigurationId
    const menus = await Menu.findAll({
      attributes: ['id', 'name', 'canteenId', 'menuConfigurationId'],
    });

    const ordersWithMenuName = totalOrders.map((order) => {
      const matchedMenu = menus.find(
        (menu) =>
          menu.canteenId === order.canteenId &&
          menu.menuConfigurationId === order.menuConfigurationId
      );

      return {
        ...order.toJSON(),
        menuName: matchedMenu?.name || null,
      };
    });

    if (!ordersWithMenuName.length) {
      return res.status(200).json({data:[], message: 'No orders found' });
    }

    return res.status(200).json({
      message: 'Orders fetched successfully',
      data: ordersWithMenuName,
    });
  } catch (error: unknown) {
    console.error(`Error fetching orders: ${error instanceof Error ? error.message : error}`);
    return res.status(500).json({ message: 'Failed to fetch total orders' });
  }
};











export const getTotalAmount = async (req: Request, res: Response): Promise<Response> => {
  try {
    const totalAmount = await Order.sum('totalAmount', { where: { status: 'placed' } });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('admin.totalAmountFetched'),
      data: { totalAmount },
    });
  } catch (error: unknown) {
    logger.error(`Error fetching total amount: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};