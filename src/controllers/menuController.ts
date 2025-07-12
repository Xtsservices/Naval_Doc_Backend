import { Request, Response } from 'express';
import { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import Item from '../models/item';
import Pricing from '../models/pricing';
import { createItemValidation } from '../validations/joiValidations';
import logger from '../common/logger';
import { getMessage } from '../common/utils';
import { statusCodes } from '../common/statusCodes';
import moment from 'moment-timezone'; // Import moment-timezone
moment.tz('Asia/Kolkata')


import Menu from '../models/menu';
import MenuItem from '../models/menuItem';
import MenuConfiguration from '../models/menuConfiguration';
import Canteen from '../models/canteen'; // Import the Canteen model
import { Op } from 'sequelize';
import { compile } from 'joi';

export const createMenuWithItems = async (req: Request, res: Response): Promise<Response> => {
  let { menuConfigurationId, description, items, canteenId, startTime, endTime } = req.body; // Include startTime and endTime in the request body
  const userId = req.user?.id; // Assuming `req.user` contains the authenticated user's details

  // Validate required fields
  if (!menuConfigurationId || !items || !Array.isArray(items) || items.length === 0 || !canteenId || !startTime || !endTime) {
    logger.error('Validation error: menuConfigurationId, items, canteenId, startTime, and endTime are required');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.validationError'),
    });
  }

  // Validate date format for startTime and endTime
  // Set startTime to the start of the day in Asia/Kolkata timezone
  // If input is only DD-MM-YYYY, set time to start of day in Asia/Kolkata timezone
  startTime = moment.tz(startTime, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day').format('DD-MM-YYYY HH:mm A');
  if (!moment(startTime, 'DD-MM-YYYY HH:mm A', true).isValid()) {
    logger.error('Validation error: startTime must be in the format DD-MM-YYYY HH:mm A');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.invalidStartTime'),
    });
  }

  // Set endTime to the end of the day in Asia/Kolkata timezone
  endTime = moment.tz(endTime, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day').format('DD-MM-YYYY HH:mm A');
  if (!moment(endTime, 'DD-MM-YYYY HH:mm A', true).isValid()) {
    logger.error('Validation error: endTime must be in the format DD-MM-YYYY HH:mm A');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.invalidEndTime'),
    });
  }

  // Ensure startTime is before endTime
  startTime = moment(startTime, 'DD-MM-YYYY HH:mm A');
  endTime = moment(endTime, 'DD-MM-YYYY HH:mm A');
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

    // Check if a menu with the same canteenId and menuConfigurationId already exists
    const existingMenu = await Menu.findOne({
      where: {
        canteenId,
        menuConfigurationId,
        status: 'active',
      },
    });

    if (existingMenu) {
      logger.warn(`Menu with canteenId ${canteenId} and menuConfigurationId ${menuConfigurationId} already exists`);
      return res.status(statusCodes.CONFLICT).json({
        message: getMessage('menu.alreadyExists'),
      });
    }

    // Create a new menu using the provided startTime and endTime

    // Set startTime to the start of the day in Asia/Kolkata timezone
    startTime = moment(startTime, 'DD-MM-YYYY').startOf('day');
    endTime = moment(endTime, 'DD-MM-YYYY').endOf('day');
    const menu = await Menu.create(
      {
        name: menuConfiguration.name, // Use the name from the configuration
        description,
        menuConfigurationId, // Reference the configuration
        canteenId, // Reference the canteen
        startTime: startTime, // Convert startTime to Unix timestamp
        endTime: endTime, // Convert endTime to Unix timestamp
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

export const updateMenuWithItems = async (req: Request, res: Response): Promise<Response> => {
  const { menuId } = req.params;
  const { items } = req.body;
  const userId = req.user?.id;

  if (!items || !Array.isArray(items) || items.length === 0) {
    logger.error('Validation error: items must be provided and must be an array');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.validationError'),
    });
  }

  const transaction: Transaction = await sequelize.transaction();

  try {
    const menu = await Menu.findByPk(menuId, { transaction });
    if (!menu) {
      logger.warn(`Menu with ID ${menuId} not found`);
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('menu.notFound'),
      });
    }

    const incomingItemIds = items.map(item => item.itemId);

    // Step 1: Fetch all existing MenuItems for this menu
    const existingMenuItems = await MenuItem.findAll({
      where: { menuId },
      transaction,
    });

    // Step 2: Deactivate items not present in the new list
    for (const menuItem of existingMenuItems) {
      if (!incomingItemIds.includes(menuItem.itemId)) {
        await menuItem.update(
          {
            status: 'inactive',
            updatedById: userId,
          },
          { transaction }
        );
        logger.info(`Marked item ID ${menuItem.itemId} as inactive for menu ID ${menuId}`);
      }
    }

    // Step 3: Create or update items in the incoming list
    for (const item of items) {
      const { itemId, minQuantity, maxQuantity } = item;

      const existingItem = await Item.findByPk(itemId, { transaction });
      if (!existingItem) {
        logger.warn(`Item with ID ${itemId} not found`);
        await transaction.rollback();
        return res.status(statusCodes.NOT_FOUND).json({
          message: getMessage('item.itemNotFound'),
        });
      }

      const existingMenuItem = await MenuItem.findOne({
        where: { menuId, itemId },
        transaction,
      });

      if (existingMenuItem) {
        await existingMenuItem.update(
          {
            minQuantity: minQuantity ?? existingMenuItem.minQuantity,
            maxQuantity: maxQuantity ?? existingMenuItem.maxQuantity,
            status: 'active', // re-activate if previously inactive
            updatedById: userId,
          },
          { transaction }
        );
        logger.info(`Updated existing item with ID ${itemId} in menu ID ${menuId}`);
      } else {
        await MenuItem.create(
          {
            menuId,
            itemId,
            minQuantity,
            maxQuantity,
            status: 'active',
            createdById: userId,
            updatedById: userId,
          },
          { transaction }
        );
        logger.info(`Added new item with ID ${itemId} to menu ID ${menuId}`);
      }
    }

    await transaction.commit();
    logger.info(`Menu updated successfully with items`);

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.menuUpdatedWithItems'),
      data: menu,
    });
  } catch (error: unknown) {
    await transaction.rollback();

    if (error instanceof Error) {
      logger.error(`Error updating menu with items: ${error.message}`);
    } else {
      logger.error(`Unknown error updating menu with items: ${error}`);
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
    whereClause.status = 'active'; // Only fetch active menus
    if (canteenId) {
      whereClause.canteenId = canteenId; // Filter by canteenId if provided
    }

    const menus = await Menu.findAll({
      where: whereClause,  // Apply the filter
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
    const { canteenId } = req.query;
    const now = moment().tz('Asia/Kolkata');
    const today = now.clone().startOf('day');
    const tomorrow = now.clone().add(1, 'day').startOf('day');
    
    // Prepare date keys
    const dateKeys = [
      today.format('DD-MM-YYYY'),
      tomorrow.format('DD-MM-YYYY'),
    ];

    // Prepare unix ranges for filtering menus
    const todayUnix = today.unix();
    const tomorrowEndUnix = tomorrow.clone().endOf('day').unix();

    // Build where clause
    const whereClause: any = {
      startTime: { [Op.lte]: tomorrowEndUnix },
      endTime: { [Op.gte]: todayUnix },
      status: 'active',
    };
    
    if (canteenId) whereClause.canteenId = canteenId;

    const menus = await Menu.findAll({
      where: whereClause,
      include: [
        {
          model: MenuConfiguration,
          as: 'menuMenuConfiguration',
          attributes: ['id', 'name', 'defaultStartTime', 'defaultEndTime', 'status'],
          where: { status: 'active' } // Only include active menu configurations
        },
      ],
      order: [['startTime', 'ASC']],
    });

    if (menus.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: 'No Menu Found',
      });
    }

    // Initialize groupedMenus
    const groupedMenus: Record<string, Record<string, any[]>> = {};
    dateKeys.forEach(dateKey => groupedMenus[dateKey] = {});

    // Process each menu and group by date and configuration
    menus.forEach((menu) => {
      const menuData = menu.toJSON();
      const menuConfig = menuData.menuMenuConfiguration;
      const menuConfigName = menuConfig?.name || 'Unconfigured';

      // Menu's active date range
      const menuStart = moment.unix(menuData.startTime).tz('Asia/Kolkata').startOf('day');
      const menuEnd = moment.unix(menuData.endTime).tz('Asia/Kolkata').endOf('day');

      dateKeys.forEach(dateKey => {
        const currentDate = moment.tz(dateKey, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day');
        
        // Check if menu is valid for this date
        const isMenuValidForDate = currentDate.isBetween(menuStart, menuEnd, 'day', '[]');
        if (!isMenuValidForDate) return; // Skip if menu is not valid for this date

        // Initialize validity as false
        let isValid = false;
        
        // Determine if the current date is today
        const isCurrentDateToday = currentDate.isSame(today, 'day');
        
        if (isCurrentDateToday) {
          // For today, check menu configuration time
          if (menuConfig?.defaultStartTime && menuConfig?.defaultEndTime) {
            const servingStart = currentDate.clone()
              .hour(moment.unix(menuConfig.defaultStartTime).tz('Asia/Kolkata').hour())
              .minute(moment.unix(menuConfig.defaultStartTime).tz('Asia/Kolkata').minute());
            
            const servingEnd = currentDate.clone()
              .hour(moment.unix(menuConfig.defaultEndTime).tz('Asia/Kolkata').hour())
              .minute(moment.unix(menuConfig.defaultEndTime).tz('Asia/Kolkata').minute());
            
            // Check if the menu's serving window is:
            // 1. Currently active (now is between start and end)
            // 2. Coming up later today (start is after now but still today)
            const isCurrentlyActive = now.isSameOrAfter(servingStart) && now.isBefore(servingEnd);
            const isUpcomingToday = now.isBefore(servingStart) && servingStart.isSame(today, 'day');
            
            isValid = isCurrentlyActive || isUpcomingToday;
          }
        } else {
          // For future dates (tomorrow), show all menus
          isValid = true;
        }
        
        // Only add to response if valid
        if (isValid) {
          if (!groupedMenus[dateKey][menuConfigName]) {
            groupedMenus[dateKey][menuConfigName] = [];
          }
          
          groupedMenus[dateKey][menuConfigName].push({
            id: menuData.id,
            name: menuData.name,
            startTime: menuData.startTime,
            endTime: menuData.endTime,
            menuConfiguration: {
              ...menuConfig,
              formattedDefaultStartTime: menuConfig?.defaultStartTime
                ? moment.unix(menuConfig.defaultStartTime).tz('Asia/Kolkata').format('HH:mm')
                : null,
              formattedDefaultEndTime: menuConfig?.defaultEndTime
                ? moment.unix(menuConfig.defaultEndTime).tz('Asia/Kolkata').format('HH:mm')
                : null,
            },
          });
        }
      });
    });

    // Clean up empty date keys
    for (const dateKey of dateKeys) {
      if (Object.keys(groupedMenus[dateKey]).length === 0) {
        delete groupedMenus[dateKey];
      }
    }

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

export const getMenusByCanteen = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { canteenId, date } = req.query; // Extract canteenId and optional date

    if (!canteenId) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: 'Canteen ID is required.',
      });
    }

    const menus = await Menu.findAll({
      where: {
        canteenId,
        status: 'active',
      },
      attributes: ['id', 'name', 'startTime', 'endTime'],
      order: [['startTime', 'ASC']],
      include: [
        {
          model: MenuConfiguration,
          as: 'menuMenuConfiguration',
          attributes: ['id', 'name', 'defaultStartTime', 'defaultEndTime'],
        },
      ],
    });

    console.log('Menus fetched:', menus.length);
    if (menus.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: 'No menus available for the specified canteen.',
      });
    }

    // Determine target date - default to today in DD-MM-YYYY format
    let targetDate;
    const today = moment().tz('Asia/Kolkata');
    
    if (date) {
      // Parse the provided date
      targetDate = moment(date.toString(), 'DD-MM-YYYY').tz('Asia/Kolkata');
      if (!targetDate.isValid()) {
        return res.status(statusCodes.BAD_REQUEST).json({
          message: 'Invalid date format. Use DD-MM-YYYY format.',
        });
      }
    } else {
      // Default to today
      targetDate = today;
    }

    // Start of the target date
    const targetDateStart = targetDate.clone().startOf('day');
    const targetDateFormatted = targetDate.format('DD-MM-YYYY');
    
    // Get current time for comparison
    const now = moment().tz('Asia/Kolkata');
    const isToday = targetDateStart.isSame(now, 'day');
    
    // Show only menus where the target date falls within the menu configuration's default time window
    const validMenus = menus.filter((menu) => {
      const menuData = menu.toJSON();
      const config = menuData.menuMenuConfiguration;
      
      if (!config || !config.defaultStartTime || !config.defaultEndTime) {
        return false;
      }
      
      // Create moments for the menu's default start and end times
      const defaultStartTime = moment.unix(config.defaultStartTime).tz('Asia/Kolkata');
      const defaultEndTime = moment.unix(config.defaultEndTime).tz('Asia/Kolkata');
      
      // Create target date's datetime objects with these hours and minutes
      const targetDayStart = targetDateStart.clone()
        .hour(defaultStartTime.hour())
        .minute(defaultStartTime.minute());
      
      const targetDayEnd = targetDateStart.clone()
        .hour(defaultEndTime.hour())
        .minute(defaultEndTime.minute());
      
      // For today, check if current time falls within this window
      // For future dates, show all menus that would be valid on that day
      return isToday 
        ? now.isSameOrAfter(targetDayStart) && now.isBefore(targetDayEnd)
        : true; // Show all menus for future dates
    });

    if (validMenus.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: `No valid menus available for ${targetDateFormatted}.`,
      });
    }

    // Format times for response
    const formattedMenus = validMenus.map((menu) => {
      const menuData = menu.toJSON();
      
      if (menuData.menuMenuConfiguration) {
        const config = menuData.menuMenuConfiguration;
        if (config.defaultStartTime) {
          config.formattedDefaultStartTime = moment.unix(config.defaultStartTime).tz('Asia/Kolkata').format('HH:mm');
          menuData.startTime = config.formattedDefaultStartTime; // Use configuration time for display
        }
        if (config.defaultEndTime) {
          config.formattedDefaultEndTime = moment.unix(config.defaultEndTime).tz('Asia/Kolkata').format('HH:mm');
          menuData.endTime = config.formattedDefaultEndTime; // Use configuration time for display
        }
        menuData.menuConfiguration = config;
        delete menuData.menuMenuConfiguration;
      }

      return menuData;
    });

    console.log('Formatted menus:', formattedMenus.length);

    return res.status(statusCodes.SUCCESS).json({
      message: `Menus fetched successfully for ${targetDateFormatted}.`,
      data: formattedMenus,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching menus by canteen: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Internal server error.',
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
              attributes: ['id', 'name', 'description', 'image','type','status'], // Fetch necessary fields
              where: { status: 'active' }, // Fetch only items with status 'active'
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
      let menu:any=[]
      logger.warn(`Menu with ID ${id} not found`);
      return res.status(statusCodes.SUCCESS).json({
        message: getMessage('menu.notFound'),
         data: menu,
      });
    }

    // Convert menu to plain object
    const menuData = menu.toJSON();

    menuData.menuConfiguration=menuData.menuMenuConfiguration

    menuData.menuConfiguration 
    menuData.menuConfigurationId=menuData.menuConfiguration.id;
    delete menuData.menuMenuConfiguration
    // Convert item images to Base64 format
    menuData.menuItems = menuData.menuItems.map((menuItem: any) => {
      menuItem.item=  menuItem.menuItemItem;
      delete menuItem.menuItemItem;


      if (menuItem.item && menuItem.item.image) {
        try {
          // Convert image to Base64
          menuItem.item.image = Buffer.from(menuItem.item.image).toString('base64');
        } catch (conversionError) {
          logger.error(`Error converting image to Base64 for item ID ${menuItem.item.id}: ${conversionError}`);
          menuItem.item.image = null; // Set image to null if conversion fails
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

export const getMenuByIdforwhatsapp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { menuId } = req.query;

    // Validate if menuId is provided
    if (!menuId) {
      return res.status(400).json({
        message: 'Menu ID is required.',
      });
    }

    // Fetch menu items and their pricing from the Item table
    const menuItems = await MenuItem.findAll({
      where: { menuId },
      attributes: ['minQuantity', 'maxQuantity'], // Include minQuantity and maxQuantity from MenuItem
      include: [
        {
          model: Item,
          as: 'menuItemItem', // Ensure this matches the alias in the MenuItem -> Item association
          attributes: ['id', 'name', 'description'], // Fetch necessary item fields
          include: [
            {
              model: Pricing,
              as: 'pricing', // Ensure this matches the alias in the Item -> Pricing association
              attributes: ['price', 'currency'], // Fetch necessary pricing fields
            },
          ],
        },
      ],
    });

    if (!menuItems || menuItems.length === 0) {
      return res.status(404).json({
        message: 'No menu items found for the specified menu.',
      });
    }

    // Flatten the response structure
    const flattenedMenuItems = menuItems.map((menuItem: any) => {
      const item = menuItem.menuItemItem;
      const pricing = item?.pricing || {};
      return {
        id: item?.id || null,
        name: item?.name || null,
        description: item?.description || null,
        price: pricing?.price || null,
        currency: pricing?.currency || null,
        minQuantity: menuItem.minQuantity || null, // Include minQuantity
        maxQuantity: menuItem.maxQuantity || null, // Include maxQuantity
      };
    });

    return res.status(200).json({
      message: 'Menu items fetched successfully.',
      data: flattenedMenuItems, // Return flattened menu items
    });
  } catch (error: unknown) {
    console.error(`Error fetching menu items: ${error instanceof Error ? error.message : error}`);
    return res.status(500).json({
      message: 'Internal server error.',
    });
  }
};


export const deleteMenu2 = async (req: Request, res: Response): Promise<Response> => {
  const { menuId } = req.body; // Extract menuId from route parameters

  try {
    // Check if the menu exists
    const menu = await Menu.findByPk(menuId);
    if (!menu) {
      logger.warn(`Menu with ID ${menuId} not found`);
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('menu.notFound'),
      });
    }

    // Update the status to inactive
    await menu.update({ status: 'inactive' });

    logger.info(`Menu with ID ${menuId} marked as inactive`);
    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.menuDeleted'),
    });
  } catch (error: unknown) {
    logger.error(`Error marking menu as inactive: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const deleteMenu = async (req: Request, res: Response): Promise<Response> => {
  const { menuId } = req.body;

  try {
    // Check if the menu exists
    const menu = await Menu.findByPk(menuId);

    if (!menu) {
      logger.warn(`Menu with ID ${menuId} not found`);
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('menu.notFound'),
      });
    }

    // ✅ Only update the status field
    await Menu.update(
      { status: 'inactive' },
      { where: { id: menuId } }
    );

    logger.info(`Menu with ID ${menuId} marked as inactive`);
    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.menuDeleted'),
    });
  } catch (error: unknown) {
    logger.error(`Error marking menu as inactive: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};


