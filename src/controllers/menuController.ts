import { Request, Response } from 'express';
import { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import Item from '../models/item';
import Pricing from '../models/pricing';
import { createItemValidation } from '../validations/joiValidations';
import logger from '../common/logger';
import { getMessage } from '../common/utils';
import { statusCodes } from '../common/statusCodes';
import moment from 'moment-timezone';
moment.tz.setDefault('Asia/Kolkata');


import Menu from '../models/menu';
import MenuItem from '../models/menuItem';
import MenuConfiguration from '../models/menuConfiguration';
import Canteen from '../models/canteen'; // Import the Canteen model
import { Op } from 'sequelize';

export const createMenuWithItems = async (req: Request, res: Response): Promise<Response> => {
  let { menuConfigurationId, description, items, canteenId, startTime, endTime } = req.body; // Include startTime and endTime in the request body
  const userId = req.user?.id; // Assuming `req.user` contains the authenticated user's details

  // Validate required fields
  if (!menuConfigurationId || !items || !Array.isArray(items) || !canteenId || !startTime || !endTime) {
    logger.error('Validation error: menuConfigurationId, items, canteenId, startTime, and endTime are required');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.validationError'),
    });
  }

  // Validate date format for startTime and endTime
  if (!moment(startTime, 'DD-MM-YYYY', true).isValid()) {
    logger.error('Validation error: startTime must be in the format DD-MM-YYYY');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.invalidStartTime'),
    });
  }

  if (!moment(endTime, 'DD-MM-YYYY', true).isValid()) {
    logger.error('Validation error: endTime must be in the format DD-MM-YYYY');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.invalidEndTime'),
    });
  }

  // Ensure startTime is before endTime
  startTime = moment(startTime, 'DD-MM-YYYY');
  endTime = moment(endTime, 'DD-MM-YYYY');
  if (!startTime.isBefore(endTime)) {
    logger.error('Validation error: startTime must be before endTime');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.startTimeBeforeEndTime'),
    });
  }

  const transaction: Transaction = await sequelize.transaction();

  try {
    // Check if the canteen exists
    const canteen = await Canteen.findByPk(canteenId);
    if (!canteen) {
      logger.warn(`Canteen with ID ${canteenId} not found`);
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('canteen.notFound'),
      });
    }

    // Fetch the menu configuration
    const menuConfiguration = await MenuConfiguration.findByPk(menuConfigurationId);
    if (!menuConfiguration) {
      logger.warn(`Menu configuration with ID ${menuConfigurationId} not found`);
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('menuConfiguration.notFound'),
      });
    }

    // Create a new menu using the provided startTime and endTime
    const menu = await Menu.create(
      {
        name: menuConfiguration.name, // Use the name from the configuration
        description,
        menuConfigurationId, // Reference the configuration
        canteenId, // Reference the canteen
        startTime, // Use the startTime from the payload
        endTime, // Use the endTime from the payload
        status: 'active',
        createdById: userId,
        updatedById: userId,
      },
      { transaction }
    );

    // Add items to the menu
    for (const item of items) {
      const { itemId, minQuantity, maxQuantity } = item;

      const existingItem = await Item.findByPk(itemId, { transaction });
      if (!existingItem) {
        logger.warn(`Item with ID ${itemId} not found`);
        return res.status(statusCodes.NOT_FOUND).json({
          message: getMessage('item.itemNotFound'),
        });
      }

      await MenuItem.create(
        {
          menuId: menu.id,
          itemId,
          minQuantity,
          maxQuantity,
          status: 'active',
          createdById: userId,
          updatedById: userId,
        },
        { transaction }
      );
    }

    await transaction.commit();

    logger.info(`Menu created successfully with items`);
    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.menuCreatedWithItems'),
      data: menu,
    });
  } catch (error: unknown) {
    await transaction.rollback();

    if (error instanceof Error) {
      logger.error(`Error creating menu with items: ${error.message}`);
    } else {
      logger.error(`Unknown error creating menu with items: ${error}`);
    }

    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getAllMenus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { canteenId } = req.query; // Extract canteenId from query parameters

    // Build the where clause dynamically
    const whereClause: any = {};
    if (canteenId) {
      whereClause.canteenId = canteenId; // Filter by canteenId if provided
    }

    const menus = await Menu.findAll({
      where: whereClause, // Apply the filter
      include: [
        {
          model: Canteen,
          as: 'canteenMenu', // Include canteen details
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

    // Convert item images to Base64 format
    const menusWithBase64Images = menus.map((menu) => {
      const menuData = menu.toJSON();
      menuData.menuItems = menuData.menuItems.map((menuItem: any) => {
        if (menuItem.menuItemItem && menuItem.menuItemItem.image) {
          // Convert image to Base64
          menuItem.menuItemItem.image = Buffer.from(menuItem.menuItemItem.image).toString('base64');
        }
        return menuItem;
      });
      return menuData;
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.menusFetched'),
      data: menusWithBase64Images,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching menus: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getMenusForNextTwoDaysGroupedByDateAndConfiguration = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { canteenId } = req.query; // Optional filter by canteenId
    // Use moment to get the current date and next 2 days
    const now = moment(); // Current time
    const today = moment().startOf('day');
    const tomorrow = moment().add(1, 'days').startOf('day');
    const dayAfterTomorrow = moment().add(2, 'days').startOf('day');

    const todayUnix = today.unix(); // Start of today as Unix timestamp
    const dayAfterTomorrowUnix = moment().add(2, 'days').endOf('day').unix(); // End of the day after tomorrow as Unix timestamp

    // Construct where clause to fetch menus valid from today to dayAfterTomorrow
    const whereClause: any = {
      startTime: {
        [Op.lte]: dayAfterTomorrowUnix, // Menus that start on or before dayAfterTomorrow
      },
      endTime: {
        [Op.gte]: todayUnix, // Menus that end on or after today
      },
    };

    if (canteenId) {
      whereClause.canteenId = canteenId; // Filter by canteenId if provided
    }

    // Debug the SQL query

    const menus = await Menu.findAll({
      where: whereClause,
      include: [
        {
          model: MenuConfiguration,
          as: 'menuMenuConfiguration',
          attributes: ['id', 'name', 'defaultStartTime', 'defaultEndTime'], // Use defaultStartTime and defaultEndTime
        },
      ],
      order: [['startTime', 'ASC']], // Order by startTime to ensure consistent grouping
      logging: console.log // Log the SQL query
    });

  if(menus.length ===0){
    return res.status(statusCodes.NOT_FOUND).json({
      message: 'No Menu Found',
    });

  }


    // Initialize grouped menus with empty objects for the next three days
    const groupedMenus: Record<string, Record<string, any[]>> = {
      [today.format('DD-MM-YYYY')]: {},
      [tomorrow.format('DD-MM-YYYY')]: {},
      [dayAfterTomorrow.format('DD-MM-YYYY')]: {},
    };

    // Iterate over each menu and check if its date range overlaps with the grouped dates
    menus.forEach((menu, index) => {
      const menuData = menu.toJSON();
      
      const menuStartDate = moment.unix(menuData.startTime).startOf('day');
      const menuEndDate = moment.unix(menuData.endTime).endOf('day');
      const menuConfigName = menuData.menuConfiguration?.name || 'Unconfigured';

      // Check if menuConfiguration is valid for the current date
      const menuConfigStartTime = menuData.menuConfiguration?.defaultStartTime
        ? moment.unix(menuData.menuConfiguration.defaultStartTime)
        : null;
      const menuConfigEndTime = menuData.menuConfiguration?.defaultEndTime
        ? moment.unix(menuData.menuConfiguration.defaultEndTime)
        : null;

      // Convert defaultEndTime to HH:MM A format for display
      const formattedDefaultEndTime = menuData.menuConfiguration?.defaultEndTime
        ? moment.unix(menuData.menuConfiguration.defaultEndTime).format('HH:mm A')
        : null;

      // Iterate over the groupedMenus keys (dates)
      Object.keys(groupedMenus).forEach((dateKey) => {
        const currentDate = moment(dateKey, 'DD-MM-YYYY').startOf('day');

        // Check if the current date falls within the menu's start and end date range
        const isMenuValid = currentDate.isBetween(menuStartDate, menuEndDate, 'day', '[]');

        // For future dates (tomorrow and dayAfterTomorrow), we only care about menu validity
        // For today, we need to check the current time against the menu configuration time
        let isValid = false;
        
        if (currentDate.isAfter(today, 'day')) {
          // For tomorrow and dayAfterTomorrow
          isValid = isMenuValid;
        } else {
          // For today
          const isTimeValidForToday =
            (!menuConfigStartTime || now.isSameOrAfter(menuConfigStartTime)) &&
            (!menuConfigEndTime || now.isSameOrBefore(menuConfigEndTime));
          isValid = isMenuValid && isTimeValidForToday;
        }

        if (isValid) {
          // Initialize the configuration group if it doesn't exist
          if (!groupedMenus[dateKey][menuConfigName]) {
            groupedMenus[dateKey][menuConfigName] = [];
          }

          // Push the menu data into the appropriate group
          groupedMenus[dateKey][menuConfigName].push({
            id: menuData.id, // Include menu ID
            name: menuData.name,
            startTime: menuData.startTime,
            endTime: menuData.endTime,
            menuConfiguration: {
              ...menuData.menuConfiguration,
              formattedDefaultEndTime, // Add formatted defaultEndTime
            },
          });
          
        }
      });
    });


    return res.status(statusCodes.SUCCESS).json({
      message: 'Menus fetched successfully',
      data: groupedMenus,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching menus for the next two days: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Internal server error',
    });
  }
};

export const getMenuById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.query; // Get menu ID from query parameters

    // Validate if the menu ID is provided
    if (!id) {
      logger.error('Validation error: Menu ID is required');
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.validationError'),
      });
    }

    // Fetch the menu by ID with related data
    const menu = await Menu.findByPk(id as string, {
      include: [
        {
          model: MenuConfiguration,
          as: 'menuMenuConfiguration', // Include menu configuration details
          attributes: ['id', 'name', 'defaultStartTime', 'defaultEndTime'], // Fetch necessary fields
        },
        {
          model: MenuItem,
          as: 'menuItems', // Include menu items
          include: [
            {
              model: Item,
              as: 'menuItemItem', // Include item details
              attributes: ['id', 'name', 'description', 'image'], // Fetch necessary fields
              include: [
                {
                  model: Pricing,
                  as: 'pricing', // Include pricing details
                  attributes: ['id', 'price', 'currency'], // Fetch necessary fields
                },
              ],
            },
          ],
        },
      ],
      attributes: ['id', 'name', 'description', 'startTime', 'endTime', 'createdAt', 'updatedAt'], // Fetch necessary menu fields
    });

    // If the menu is not found, return a 404 response
    if (!menu) {
      logger.warn(`Menu with ID ${id} not found`);
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('menu.notFound'),
      });
    }

    // Convert menu to plain object
    const menuData = menu.toJSON();

    // Convert item images to Base64 format
    menuData.menuItems = menuData.menuItems.map((menuItem: any) => {
      if (menuItem.menuItemItem && menuItem.menuItemItem.image) {
        try {
          // Convert image to Base64
          menuItem.menuItemItem.image = Buffer.from(menuItem.menuItemItem.image).toString('base64');
        } catch (conversionError) {
          logger.error(`Error converting image to Base64 for item ID ${menuItem.menuItemItem.id}: ${conversionError}`);
          menuItem.menuItemItem.image = null; // Set image to null if conversion fails
        }
      }
      return menuItem;
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.menuFetched'),
      data: menuData,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching menu by ID: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};


