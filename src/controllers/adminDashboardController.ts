import { Request, Response } from 'express';
import logger from '../common/logger';
import { getMessage } from '../common/utils';
import { statusCodes } from '../common/statusCodes';
import { sequelize } from '../config/database'; // Import sequelize for transaction management
import { responseHandler } from '../common/responseHandler';
import Order from '../models/order';
import Item from '../models/item';
import Canteen from '../models/canteen';
import Menu from '../models/menu';
import { User } from '../models';
import MenuItem from '../models/menuItem';
import MenuConfiguration from '../models/menuConfiguration';
import Pricing from '../models/pricing';

export const adminDashboard = async (req: Request, res: Response): Promise<Response> => {
  try {

    console.log(req.params,req.query)
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
    const { canteenId, status } = req.query; // Extract canteenId and status from query parameters

    // Build the where condition dynamically
    const whereCondition: any = {};
    if (canteenId) {
      whereCondition.canteenId = canteenId; // Filter by canteenId if provided
    }

    // Add status filter if provided and not 'all'
    if (status && status !== 'all') {
      whereCondition.status = status; // Filter by specific status
    }

    const totalOrders = await Order.findAll({
      where: whereCondition, // Apply the dynamic where condition
      include: [
        {
          model: User, // Include the User model
          as: 'orderUser', // Use the correct alias defined in the association
          attributes: ['id', 'firstName', 'lastName', 'email', 'mobile'], // Fetch necessary user fields
        },
        {
          model: Canteen, // Include the Canteen model
          as: 'orderCanteen', // Use the correct alias defined in the association
          attributes: ['id', 'canteenName'], // Fetch necessary canteen fields
        },
      ],
      attributes: ['id', 'totalAmount', 'status', 'createdAt', 'updatedAt'], // Fetch necessary order fields
    });

  if(totalOrders && totalOrders.length === 0) 
    {
      return res.status(404).json({
        message: 'NO Orders Found',
      });

    }else{
      return res.status(200).json({
        message: 'Total orders fetched successfully',
        data: totalOrders,
      });

    }
   
  }catch (error: unknown) {
    console.error(`Error fetching total orders: ${error instanceof Error ? error.message : error}`);
    return res.status(500).json({
      message: 'Failed to fetch total orders',
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