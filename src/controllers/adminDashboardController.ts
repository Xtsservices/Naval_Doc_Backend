import { Request, Response } from 'express';
import logger from '../common/logger';
import { getMessage } from '../common/utils';
import { statusCodes } from '../common/statusCodes';
import { sequelize } from '../config/database'; // Import sequelize for transaction management
import { Op, QueryTypes } from 'sequelize';
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
      where: { 
      ...whereCondition, 
      status: { [Op.in]: ['placed', 'completed'] } // Filter by status 'placed' and 'completed'
      },
    });
    // Extract total orders and total amount from the summary

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


    // Get today's date range in Asia/Kolkata timezone
    const todayStart = moment().tz('Asia/Kolkata').startOf('day').unix();
    const todayEnd = moment().tz('Asia/Kolkata').endOf('day').unix();

    // Fetch today's orders count and revenue
    const todayOrdersSummary = await Order.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'todayOrders'],
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'todayRevenue'],
      ],
      where: {
        ...whereCondition,
        status: { [Op.in]: ['placed', 'completed'] },
        orderDate: { [Op.gte]: todayStart, [Op.lte]: todayEnd },
      },
      raw: true, // Ensures the result is a plain object, not an Order instance
    });

    const todayOrders = Number(todayOrdersSummary[0]?.todayOrders) || 0;
    const todayRevenue = Number(todayOrdersSummary[0]?.todayRevenue) || 0;

    // Combine all data into a single response
    const dashboardSummary = {
      totalOrders,
      totalAmount,
      completedOrders,
      cancelledOrders,
      totalItems,
      totalCanteens,
      totalMenus,
      todayOrders,
      todayRevenue,
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
              where: { status: 'active' }, // Ensure only active items are included
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
      attributes: ['id', 'name', 'createdAt', 'description','updatedAt','startTime','endTime'], // Fetch necessary menu fields
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
    const { canteenId, orderDate } = req.query;

    // Build where condition
    const whereCondition: any = {
      status: { [Op.in]: ['placed', 'completed'] },
    };
    const replacements: any = {};

    // Canteen filter
    if (canteenId) {
      whereCondition.canteenId = canteenId;
      replacements.canteenId = canteenId;
    }

    // Date filter (DD-MM-YYYY) or default to today
    let startDate: number;
    let endDate: number;
    if (orderDate && typeof orderDate === 'string') {
      const parsedDate = moment.tz(orderDate, 'DD-MM-YYYY', 'Asia/Kolkata');
      if (!parsedDate.isValid()) {
        return res.status(statusCodes.BAD_REQUEST).json({ message: 'Invalid orderDate format. Use DD-MM-YYYY' });
      }
      startDate = parsedDate.startOf('day').unix();
      endDate = parsedDate.endOf('day').unix();
    } else {
      // Default to today in Asia/Kolkata timezone
      startDate = moment().tz('Asia/Kolkata').startOf('day').unix();
      endDate = moment().tz('Asia/Kolkata').endOf('day').unix();
    }
    whereCondition.orderDate = { [Op.gte]: startDate, [Op.lte]: endDate };
    replacements.orderDate = startDate;
    replacements.endDate = endDate;

    // Total amount (all placed and completed orders)
    const totalAmountResult = await Order.findAll({
      where: whereCondition,
      attributes: [
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalAmount'],
        'canteenId',
      ],
      group: ['canteenId'],
      raw: true,
    });
    const totalAmount = totalAmountResult.length > 0 ? Number(totalAmountResult[0].totalAmount) || 0 : 0;

    // Count orders by status: placed, completed, cancelled
    const [placed, completed, cancelled] = await Promise.all([
      Order.count({ where: { ...whereCondition, status: 'placed' } }),
      Order.count({ where: { ...whereCondition, status: 'completed' } }),
      Order.count({
        where: {
          ...whereCondition,
          status: 'cancelled',
          orderDate: { [Op.gte]: startDate, [Op.lte]: endDate },
        },
      }),
    ]);
    const total = placed + completed;

    // Item-wise counts using raw query
    const whereClauses: string[] = [`o."status" IN ('placed', 'completed')`];
    if (canteenId) {
      whereClauses.push(`o."canteenId" = :canteenId`);
    }
    whereClauses.push(`o."orderDate" >= :orderDate AND o."orderDate" <= :endDate`);

    const itemCounts = await sequelize.query(
      `
      SELECT 
        i.id AS "itemId",
        i.name AS "itemName",
        mc.name AS "menuName",
        SUM(oi."quantity") AS "totalQuantity"
      FROM orders o
      JOIN order_items oi ON oi."orderId" = o.id
      JOIN items i ON oi."itemId" = i.id
      JOIN menu_configurations mc ON o."menuConfigurationId" = mc.id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY i.id, i.name, mc.name
      ORDER BY i.name
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    return res.status(statusCodes.SUCCESS).json({
      message: 'Order summary fetched successfully',
      data: {
        totalAmount,
        placed: { count: placed },
        completed: { count: completed },
        cancelled: { count: cancelled },
        itemWiseCounts: itemCounts,
        totalOrders: total,
      },
    });
  } catch (error: unknown) {
    logger.error(
      `Error fetching total orders: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Failed to fetch total orders due to an internal server error',
    });
  }
};



export const getTotalOrders2 = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { canteenId, orderDate } = req.query;
    const whereCondition: any = {};
    if (canteenId) whereCondition.canteenId = canteenId;

    // Date filter (DD-MM-YYYY)
    if (orderDate && typeof orderDate === 'string') {
      const parsedDate = moment.tz(orderDate, 'DD-MM-YYYY', 'Asia/Kolkata');
      const dateUnix = parsedDate.startOf('day').unix();
      whereCondition.orderDate = dateUnix;
    }

    // Total amount (all placed and completed orders)
    const totalAmountResult = await Order.findAll({
      where: { 
      ...whereCondition, 
      status: { [Op.in]: ['placed', 'completed'] }
      },
      attributes: [
      [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalAmount'],
      'canteenId'
      ],
      group: ['canteenId'],
      raw: true,
    });
    const totalAmount = Number(totalAmountResult[0]?.totalAmount) || 0;

    // Amount and count by status
    // Count orders by status: placed, completed, cancelled
    const [placed, completed] = await Promise.all([
      Order.count({ where: { ...whereCondition, status: 'placed', ...(canteenId && { canteenId }) } }),
      Order.count({ where: { ...whereCondition, status: 'completed', ...(canteenId && { canteenId }) } }),
    ]);
    const total = placed + completed ;

    // Item count grouped by menuConfigurationId using a raw query for reliability
    // Item-wise breakup: total quantity ordered for each item, grouped by item and menu configuration
    // Build dynamic WHERE conditions for raw SQL query
    const replacements: any = {};
    let whereClauses: string[] = [`o."status" IN ('placed', 'completed')`];

    if (canteenId) {
      whereClauses.push(`o."canteenId" = :canteenId`);
      replacements.canteenId = canteenId;
    }

    if (orderDate && typeof orderDate === 'string') {
      const parsedDate = moment.tz(orderDate, 'DD-MM-YYYY', 'Asia/Kolkata');
      const dateUnix = parsedDate.startOf('day').unix();
      whereClauses.push(`o."orderDate" = :orderDate`);
      replacements.orderDate = dateUnix;
    }

    // Get total orders grouped by item only (avoiding menu configuration duplicates)
    const itemCounts = await sequelize.query(
      `
      SELECT 
      i.id AS "itemId",
      i.name AS "itemName",
      mc.name AS "menuName",
      SUM(oi."quantity") AS "totalQuantity"
      FROM orders o
      JOIN order_items oi ON oi."orderId" = o.id
      JOIN items i ON oi."itemId" = i.id
      JOIN menu_configurations mc ON o."menuConfigurationId" = mc.id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY i.id, i.name, mc.name
      ORDER BY i.name
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    // Format itemCounts to match the expected structure
    return res.status(200).json({
      message: 'Order summary fetched successfully',
      data: {
        totalAmount,
        placed: { count: placed },
        completed: { count: completed },
        cancelled: { count: 0 },
        itemWiseCounts: itemCounts,
        totalOrders: total,
      },
    });
  } catch (error: unknown) {
    logger.error(`Error fetching total orders: ${error instanceof Error ? error.message : error}`);
    return res.status(500).json({ message: 'Failed to fetch total orders' });
  }
};

export const getOrdersWithPagination = async (req: Request, res: Response): Promise<Response> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const offset = (page - 1) * limit;

    const { canteenId, status, date, mobile } = req.query;
    const whereCondition: any = {};
    if (canteenId) whereCondition.canteenId = canteenId;
    if (status) whereCondition.status = status;

    // Filter by date (DD-MM-YYYY)
    if (date && typeof date === 'string') {
      const parsedDate = moment.tz(date, 'DD-MM-YYYY', 'Asia/Kolkata');
      const dateUnix = parsedDate.startOf('day').unix();
      whereCondition.orderDate = dateUnix;
    }

    // Filter by user mobile number
    let userWhere: any = {};
    if (mobile && typeof mobile === 'string') {
      userWhere.mobile = mobile;
    }

    const { count, rows } = await Order.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'orderUser',
          attributes: ['id', 'firstName', 'lastName', 'mobile', 'email'],
          where: Object.keys(userWhere).length ? userWhere : undefined,
        },
        {
          model: Canteen,
          as: 'orderCanteen',
          attributes: ['id', 'canteenName'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.status(statusCodes.SUCCESS).json({
      message: 'Orders fetched successfully',
      data: {
        total: count,
        page,
        limit,
        orders: rows,
      },
    });
  } catch (error: unknown) {
    logger.error(`Error fetching paginated orders: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
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



