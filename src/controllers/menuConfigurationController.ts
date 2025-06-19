import { Request, Response } from 'express';
import MenuConfiguration from '../models/menuConfiguration';
import logger from '../common/logger';
import { statusCodes } from '../common/statusCodes';
import { getMessage } from '../common/utils';
import moment from 'moment-timezone'; // Import moment-timezone
moment.tz('Asia/Kolkata')
import { Op } from 'sequelize';

// Allowed menu names
const ALLOWED_MENU_NAMES = ['Breakfast', 'Lunch', 'Snack'];

// Create a new menu configuration
export const createMenuConfiguration = async (req: Request, res: Response): Promise<Response> => {
  const { name, defaultStartTime, defaultEndTime, status } = req.body;
  const userId = req.user?.id; // Assuming `req.user` contains the authenticated user's details

  // Validate name
  if (!ALLOWED_MENU_NAMES.includes(name)) {
    logger.error(`Validation error: Invalid menu name "${name}". Allowed names are ${ALLOWED_MENU_NAMES.join(', ')}`);
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.invalidMenuName'),
    });
  }

  // Check if the name already exists
  const existingConfiguration = await MenuConfiguration.findOne({ where: { name } });
  if (existingConfiguration) {
    logger.error(`Validation error: Menu configuration with name "${name}" already exists`);
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.menuNameExists'),
    });
  }

  // Validate and convert defaultStartTime and defaultEndTime
  const startTimeUnix = moment(defaultStartTime, 'hh:mm A', true).unix();
  const endTimeUnix = moment(defaultEndTime, 'hh:mm A', true).unix();

  if (!startTimeUnix || !endTimeUnix) {
    logger.error('Validation error: Invalid time format. Expected format is HH:MM AM/PM.');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.invalidTimeFormat'),
    });
  }

  try {
    const configuration = await MenuConfiguration.create({
      name,
      defaultStartTime: startTimeUnix,
      defaultEndTime: endTimeUnix,
      status: status || 'active', // Default to 'active' if not provided
      createdById: userId,
      updatedById: userId,
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.menuConfigurationCreated'),
      data: configuration,
    });
  } catch (error: unknown) {
    logger.error(`Error creating menu configuration: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

// Update an existing menu configuration
export const updateMenuConfiguration = async (req: Request, res: Response): Promise<Response> => {
  const { id,  defaultStartTime, defaultEndTime } = req.body;
  const userId = req.user?.id; // Assuming `req.user` contains the authenticated user's details

  // No name validation or update in this section

  // If you want to allow updating the name, uncomment and add 'name' to the destructuring above.
  // const { id, name, defaultStartTime, defaultEndTime, status } = req.body;

  // If name update is not allowed, remove this block entirely.
  // If name update is allowed, uncomment and use the following:

  /*
  if (name) {
    const existingConfiguration = await MenuConfiguration.findOne({
      where: { name, id: { [Op.ne]: id } }, // Exclude the current record
    });
    if (existingConfiguration) {
      logger.error(`Validation error: Menu configuration with name "${name}" already exists`);
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('validation.menuNameExists'),
      });
    }
  }
  */

  // Validate and convert defaultStartTime and defaultEndTime
  const startTimeUnix = defaultStartTime ? moment(defaultStartTime, 'hh:mm A', true).unix() : undefined;
  const endTimeUnix = defaultEndTime ? moment(defaultEndTime, 'hh:mm A', true).unix() : undefined;

  if ((defaultStartTime && !startTimeUnix) || (defaultEndTime && !endTimeUnix)) {
    logger.error('Validation error: Invalid time format. Expected format is HH:MM AM/PM.');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('validation.invalidTimeFormat'),
    });
  }

  try {
    const configuration :any = await MenuConfiguration.findByPk(id);
    if (!configuration) {
      logger.warn(`Menu configuration with ID ${id} not found`);
      return res.status(statusCodes.NOT_FOUND).json({
      message: getMessage('menuConfiguration.notFound'),
      });
    }

    await configuration.update({
      // name, // Uncomment if name update is allowed and handled above
      defaultStartTime: startTimeUnix || configuration.defaultStartTime,
      defaultEndTime: endTimeUnix || configuration.defaultEndTime,
      updatedById: userId,
    });


    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.menuConfigurationUpdated'),
      data: configuration,
    });
  } catch (error: unknown) {
    logger.error(`Error updating menu configuration: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};


export const getAllMenuConfigurations = async (req: Request, res: Response): Promise<Response> => {
    try {
      const configurations = await MenuConfiguration.findAll();
      return res.status(statusCodes.SUCCESS).json({
        message: getMessage('success.menuConfigurationsFetched'),
        data: configurations,
      });
    } catch (error: unknown) {
      logger.error(`Error fetching menu configurations: ${error instanceof Error ? error.message : error}`);
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: getMessage('error.internalServerError'),
      });
    }
  };


  export const deleteMenuConfiguration = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
  
    try {
      const configuration = await MenuConfiguration.findByPk(id);
      if (!configuration) {
        logger.warn(`Menu configuration with ID ${id} not found`);
        return res.status(statusCodes.NOT_FOUND).json({
          message: getMessage('menuConfiguration.notFound'),
        });
      }
  
      await configuration.destroy();
  
      return res.status(statusCodes.SUCCESS).json({
        message: getMessage('success.menuConfigurationDeleted'),
      });
    } catch (error: unknown) {
      logger.error(`Error deleting menu configuration: ${error instanceof Error ? error.message : error}`);
      return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
        message: getMessage('error.internalServerError'),
      });
    }
  };