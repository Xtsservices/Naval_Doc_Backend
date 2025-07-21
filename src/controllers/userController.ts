import { Request, Response } from 'express';
import { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import Canteen from '../models/canteen';
import User from '../models/user';
import Role from '../models/role';
import UserRole from '../models/userRole';
import { createCanteenValidation } from '../validations/joiValidations';
import { getMessage } from '../common/utils';
import { statusCodes } from '../common/statusCodes';
import logger from '../common/logger';



export const getAllCanteens = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Fetch all canteens

    const canteens = await Canteen.findAll();

    if (!canteens || canteens.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('canteen.noCanteensFound'),
      });
    }

    // Convert buffer image to base64 string
    const canteensWithImages = canteens.map((canteen) => {
      const canteenData = canteen.toJSON();
      if (canteenData.canteenImage) {
        canteenData.canteenImage = `data:image/jpeg;base64,${canteenData.canteenImage.toString('base64')}`;
      }
      return canteenData;
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.canteensFetched'),
      data: canteensWithImages,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error fetching canteen details: ${error.message}`);
    } else {
      logger.error(`Unknown error fetching canteen details: ${error}`);
    }

    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};