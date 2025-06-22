import e, { Request, Response } from 'express';
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

export const createCanteen = async (req: Request, res: Response): Promise<Response> => {
    
    const { canteenName, canteenCode, firstName, lastName, email, mobile } = req.body;
  const canteenImage = req.file?.buffer; // Get the binary data of the uploaded image

  // Validate the request body
  const { error } = createCanteenValidation.validate({ canteenName, canteenCode, firstName, lastName, email, mobile });
  if (error) {
    logger.error(`Validation error: ${error.details[0].message}`);
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('error.validationError'),
    });
  }

  const transaction: Transaction = await sequelize.transaction();

  try {
    // Check if a canteen with the same code already exists
    const existingCanteen = await Canteen.findOne({ where: { canteenCode }, transaction });
    if (existingCanteen) {
      logger.warn(`Canteen with code ${canteenCode} already exists`);
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('canteen.canteenCodeExists'),
      });
    }

    // Create a new canteen
    const canteen: any = await Canteen.create(
      {
        canteenName,
        canteenCode,
        canteenImage, // Store the binary image data
      },
      { transaction }
    );

    // Check if the "Canteen Admin" role exists
    const [canteenAdminRole] = await Role.findOrCreate({
      where: { name: 'Canteen Admin' },
      transaction,
    });

    // Create the user for the canteen admin
    const user = await User.create(
      {
        firstName: firstName,
        lastName: lastName,
        email: email,
        mobile: mobile,
        canteenId: canteen.id, // Associate the user with the canteen
      },
      { transaction }
    );

    // Assign the "Canteen Admin" role to the user
    await UserRole.create(
      {
        userId: user.id,
        roleId: canteenAdminRole.id,
      },
      { transaction }
    );

    // Commit the transaction
    await transaction.commit();

    logger.info(`Canteen and admin user created successfully: ${canteenName}`);
    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.canteenCreated'),
      data: { canteen, adminUser: user },
    });
  } catch (error: unknown) {
    // Rollback the transaction in case of an error
    await transaction.rollback();
    if (error instanceof Error) {
      logger.error(`Error creating canteen: ${error.message}`);
    } else {
      logger.error(`Unknown error creating canteen: ${error}`);
    }

    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getAllCanteens = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Fetch all canteens with associated user details
    const canteens = await Canteen.findAll({
      include: [
        {
          model: User,
          as: 'adminUser', // Ensure this matches the alias in the Canteen -> User association
          attributes: ['id', 'firstName', 'lastName', 'email', 'mobile'], // Fetch necessary user fields
        },
      ],
    });

    if (!canteens || canteens.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('canteen.noCanteensFound'),
      });
    }

    // Convert buffer image to base64 string
    const canteensWithImagesAndUsers = canteens.map((canteen) => {
      const canteenData = canteen.toJSON();
      if (canteenData.canteenImage) {
        canteenData.canteenImage = `data:image/jpeg;base64,${canteenData.canteenImage.toString('base64')}`;
      }
      return canteenData;
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.canteensFetched'),
      data: canteensWithImagesAndUsers,
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

export const getAllCanteensforwhatsapp = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Fetch all canteens
    const canteens = await Canteen.findAll({
      where: { status: 'active' }, // Filter by active status
      attributes: ['id', 'canteenName', 'canteenCode'], // Select only required fields
    });

    if (!canteens || canteens.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('canteen.noCanteensFound'),
      });
    }

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.canteensFetched'),
      data: canteens, // Return the filtered canteens directly
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

export const updateCanteen = async (req: Request, res: Response): Promise<Response> => {
  const {canteenId,  firstName, lastName, email, mobile } = req.body;
  const canteenImage = req.file?.buffer; // Get the binary data of the uploaded image

  // Validate the request body
  // const { error } = createCanteenValidation.validate({

  //   firstName,
  //   lastName,
  //   email,
  //   mobile,
  // });
  // if (error) {
  //   logger.error(`Validation error: ${error.details[0].message}`);
  //   return res.status(statusCodes.BAD_REQUEST).json({
  //     message: getMessage('error.validationError'),
  //   });
  // }

  const transaction: Transaction = await sequelize.transaction();

  try {
    // Check if the canteen exists
    const canteen:any  = await Canteen.findByPk(canteenId, { transaction });
    if (!canteen) {
      await transaction.rollback();
      logger.warn(`Canteen with ID ${canteenId} not found`);
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('canteen.notFound'),
      });
    }

    // Check if a canteen with the same code already exists (excluding the current canteen)
    // Removed canteen code check as requested

  // Update the canteen details
 

  // Update the admin user details
  const adminUser = await User.findOne({ where: { canteenId: canteen.id }, transaction });
  if (adminUser) {
    await adminUser.update(
      {
      firstName: firstName ?? adminUser.firstName,
      lastName: lastName ?? adminUser.lastName,
      email: email ?? adminUser.email,
      mobile: mobile ?? adminUser.mobile,
      },
      { where: { id: adminUser.id }, transaction }
    );
  }

    // Commit the transaction
    await transaction.commit();

    logger.info(`Canteen and admin user updated successfully: `);
    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.canteenUpdated'),
      data: { canteen, adminUser },
    });
  } catch (error: unknown) {
    // Rollback the transaction in case of an error
    await transaction.rollback();
    if (error instanceof Error) {
      logger.error(`Error updating canteen: ${error.message}`);
    } else {
      logger.error(`Unknown error updating canteen: ${error}`);
    }

    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};