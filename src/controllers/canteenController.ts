import e, { Request, Response } from "express";
import { Transaction } from "sequelize";
import { sequelize } from "../config/database";
import Canteen from "../models/canteen";
import User from "../models/user";
import Role from "../models/role";
import UserRole from "../models/userRole";
import Menu from "../models/menu"; // Import Menu model
import { createCanteenValidation } from "../validations/joiValidations";
import { getMessage } from "../common/utils";
import { statusCodes } from "../common/statusCodes";
import logger from "../common/logger";
import moment from "moment-timezone"; // Import moment-timezone
moment.tz("Asia/Kolkata");
import { Op } from "sequelize";

export const createCanteen = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { canteenName, canteenCode, firstName, lastName, email, mobile } =
    req.body;
  const canteenImage = req.file?.buffer; // Get the binary data of the uploaded image

  // Validate the request body
  const { error } = createCanteenValidation.validate({
    canteenName,
    canteenCode,
    firstName,
    lastName,
    email,
    mobile,
  });
  if (error) {
    logger.error(`Validation error: ${error.details[0].message}`);
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage("error.validationError"),
    });
  }

  const transaction: Transaction = await sequelize.transaction();

  try {
    // Check if a canteen with the same code already exists
    const existingCanteen = await Canteen.findOne({
      where: { canteenCode },
      transaction,
    });
    if (existingCanteen) {
      logger.warn(`Canteen with code ${canteenCode} already exists`);
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage("canteen.canteenCodeExists"),
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
      where: { name: "Canteen Admin" },
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
      message: getMessage("success.canteenCreated"),
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
      message: getMessage("error.internalServerError"),
    });
  }
};

export const getAllCanteens = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Fetch all canteens with associated user details
    const canteens = await Canteen.findAll({
      include: [
        {
          model: User,
          as: 'canteenUsers', // Make sure this alias matches your association
          attributes: ['id', 'firstName', 'lastName', 'email', 'mobile', 'canteenId'], // Include canteenId
          required: false, // LEFT JOIN to include canteens even without users
          include: [
            {
              model: UserRole,
              as: 'userRoles',
              attributes: ['roleId'],
              required: false,
              include: [
                {
                  model: Role,
                  as: 'role',
                  attributes: ['id', 'name'],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      order: [['id', 'ASC']], // Order canteens by ID
    });

    if (!canteens || canteens.length === 0) {
      return res.status(200).json({
        message: "No canteens found",
        data: [],
      });
    }

    // Convert buffer image to base64 string and format the response
    const canteensWithImagesAndUsers = canteens.map((canteen) => {
      const canteenData = canteen.toJSON();
      
      // Convert image buffer to base64 if exists
      if (canteenData.canteenImage) {
        canteenData.canteenImage = `data:image/jpeg;base64,${canteenData.canteenImage.toString('base64')}`;
      }
      
      // Format users data with roles and canteenId
      if (canteenData.canteenUsers && canteenData.canteenUsers.length > 0) {
        canteenData.users = canteenData.canteenUsers
          .filter((user: any) => user.canteenId === canteenData.id) // Filter users by matching canteenId
          .map((user: any) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        mobile: user.mobile,
        canteenId: user.canteenId,
        fullName: `${user.firstName} ${user.lastName}`,
        roles: user.userRoles?.map((userRole: any) => ({
          id: userRole.role?.id,
          name: userRole.role?.name,
        })) || [],
          }));
        
        // Remove the original canteenUsers array
        delete canteenData.canteenUsers;
      } else {
        canteenData.users = [];
      }
      
      return canteenData;
    });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("success.canteensFetched"),
      data: canteensWithImagesAndUsers,
      count: canteensWithImagesAndUsers.length,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error fetching canteen details: ${error.message}`);
    } else {
      logger.error(`Unknown error fetching canteen details: ${error}`);
    }

    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const getAllCanteensforwhatsapp = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Fetch all canteens
    const canteens = await Canteen.findAll({
      // where: { status: 'active' }, // Filter by active status
      attributes: ["id", "canteenName", "canteenCode"], // Select only required fields
    });

    if (!canteens || canteens.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage("canteen.noCanteensFound"),
      });
    }

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("success.canteensFetched"),
      data: canteens, // Return the filtered canteens directly
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error fetching canteen details: ${error.message}`);
    } else {
      logger.error(`Unknown error fetching canteen details: ${error}`);
    }

    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage("error.internalServerError"),
    });
  }
};

export const updateCanteen = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    canteenId,
    firstName,
    lastName,
    email,
    mobile,
    canteenName,
    canteenCode,
  } = req.body;
  const canteenImage = req.file?.buffer; // Get the binary data of the uploaded image

  const transaction: Transaction = await sequelize.transaction();

  try {
    // Check if the canteen exists
    const canteen: any = await Canteen.findByPk(canteenId, { transaction });
    if (!canteen) {
      await transaction.rollback();
      logger.warn(`Canteen with ID ${canteenId} not found`);
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage("canteen.notFound"),
      });
    }

    // Prepare update object with only the fields that are provided
    const canteenUpdateData: any = {};

    if (canteenImage) canteenUpdateData.canteenImage = canteenImage; // Add image to update if provided

    // Update the canteen if there are fields to update
    if (Object.keys(canteenUpdateData).length > 0) {
      await canteen.update(canteenUpdateData, { transaction });
      logger.info(`Canteen updated with ID: ${canteenId}`);
    }

    // Update the admin user details
    const adminUser = await User.findOne({
      where: { canteenId: canteen.id },
      transaction,
    });
    if (adminUser) {
      await adminUser.update(
        {
          firstName: firstName ?? adminUser.firstName,
          lastName: lastName ?? adminUser.lastName,
          email: email ?? adminUser.email,
          mobile: mobile ?? adminUser.mobile,
        },
        { transaction }
      );
      logger.info(`Admin user updated for canteen ID: ${canteenId}`);
    }

    // Commit the transaction
    await transaction.commit();

    // Convert image to base64 for response
    const responseCanteen = canteen.toJSON();
    if (responseCanteen.canteenImage) {
      responseCanteen.canteenImage = `data:image/jpeg;base64,${responseCanteen.canteenImage.toString(
        "base64"
      )}`;
    }

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage("success.canteenUpdated"),
      data: {
        canteen: responseCanteen,
        adminUser: adminUser ? adminUser.toJSON() : null,
      },
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
      message: getMessage("error.internalServerError"),
    });
  }
};

export const getMenusByCanteen = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { canteenId } = req.query; // Extract canteenId from query parameters

    // Validate if canteenId is provided
    if (!canteenId) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: "Canteen ID is required.",
      });
    }

    // Get the current time in Unix timestamp format
    const currentTime = Math.floor(Date.now() / 1000);

    // Fetch menus filtered by canteenId and current time
    const menus = await Menu.findAll({
      where: {
        canteenId,
        startTime: { [Op.lte]: currentTime }, // Menus that have started
        endTime: { [Op.gte]: currentTime }, // Menus that haven't ended yet
      },
      attributes: ["id", "name", "startTime", "endTime"], // Select id, name, startTime, and endTime fields
      order: [["startTime", "ASC"]], // Order by startTime
    });

    if (menus.length === 0) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: "No menus available at the current time.",
      });
    }

    // Convert startTime and endTime to HH:mm format for response
    const formattedMenus = menus.map((menu) => {
      const menuData = menu.toJSON();
      menuData.startTime = moment.unix(menuData.startTime).format("HH:mm");
      menuData.endTime = moment.unix(menuData.endTime).format("HH:mm");
      return menuData;
    });

    return res.status(statusCodes.SUCCESS).json({
      message: "Menus fetched successfully.",
      data: formattedMenus, // Return the filtered and formatted menus
    });
  } catch (error: unknown) {
    logger.error(
      `Error fetching menus by canteen: ${
        error instanceof Error ? error.message : error
      }`
    );
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Internal server error.",
    });
  }
};
