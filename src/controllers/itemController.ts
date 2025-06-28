import { Request, Response } from 'express';
import { Transaction } from 'sequelize';
import moment from 'moment';
import { Item, Pricing } from '../models'; // Adjust the import paths for your models
// Update the import path below to the correct relative path where your utils file is located.
// For example, if utils.ts is in src/utils/utils.ts, use '../utils/utils'
import logger from '../common/logger';
import { statusCodes } from '../common/statusCodes';
import { getMessage } from '../common/utils';// Adjust logger import
import { sequelize } from '../config/database'; // Adjust the import path for your database configuration
import { createItemValidation,updateItemValidation } from '../validations/joiValidations';

export const createItem = async (req: Request, res: Response): Promise<Response> => {
  const { name, description, type, quantity, quantityUnit, price, startDate, endDate } = req.body;
  const image = req.file?.buffer; // Get the binary data of the uploaded image
  const status = req.body.status || 'active'; // Default status to 'active' if not provided
  const currency = req.body.currency || 'INR'; // Default currency to 'INR' if not provided

  // Validate the request body
  const { error } = createItemValidation.validate({
    name,
    description,
    type,
    quantity,
    quantityUnit,
    price,
    currency,
    startDate,
    endDate,
  });
  if (error) {
    logger.error(`Validation error: ${error.details[0].message}`);
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('error.validationError'),
    });
  }

  // Validate and convert startDate and endDate to Unix timestamps
  const startDateUnix = moment(startDate, 'DD-MM-YYYY', true);
  const endDateUnix = moment(endDate, 'DD-MM-YYYY', true);

  if (!startDateUnix.isValid() || !endDateUnix.isValid()) {
    logger.error('Invalid date format. Expected format is dd-mm-yyyy.');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('error.invalidDateFormat'),
    });
  }

  const transaction: Transaction = await sequelize.transaction();

  try {
    // Check if an item with the same name already exists
    const existingItem = await Item.findOne({ where: { name, status:"active" }, transaction });
    if (existingItem) {
      logger.warn(`Item with name "${name}" already exists`);
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('item.itemNameExists'),
      });
    }

    // Create a new item
    const item = await Item.create(
      {
        name,
        description,
        type,
        quantity,
        quantityUnit,
        image, // Store the binary image data
        status,
      },
      { transaction }
    );

    // Create the pricing for the item
    const pricing = await Pricing.create(
      {
        itemId: item.id,
        price,
        currency,
        startDate: startDateUnix.unix(), // Convert to Unix timestamp
        endDate: endDateUnix.unix(), // Convert to Unix timestamp
        status,
      },
      { transaction }
    );

    // Commit the transaction
    await transaction.commit();

    logger.info(`Item created successfully: ${name}`);
    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.itemCreated'),
      data: { item, pricing },
    });
  } catch (error: unknown) {
    // Rollback the transaction in case of an error
    await transaction.rollback();

    if (error instanceof Error) {
      logger.error(`Error creating item: ${error.message}`);
    } else {
      logger.error(`Unknown error creating item: ${error}`);
    }

    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getAllItems = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Fetch all items with their associated pricing
    const items = await Item.findAll({
      where: { status: 'active' },
      include: [
      {
        model: Pricing,
        as: 'pricing',
      },
      ],
    });

    if (items.length === 0) {
      logger.info('No items found');
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('item.noItemsFound'),
      });
    }

    // Convert image to Base64 format
    const itemsWithBase64Images = items.map((item) => {
      const itemData = item.toJSON(); // Convert Sequelize instance to plain object
      if (itemData.image) {
        itemData.image = Buffer.from(itemData.image).toString('base64'); // Convert binary image to Base64
      }
      return itemData;
    });

    logger.info('Items fetched successfully');
    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.itemsFetched'),
      data: itemsWithBase64Images,
    });
  } catch (error: unknown) {
    logger.error(`Error fetching items: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const getAllItemsCount = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Fetch the total count of items
    const totalItems = await Item.count();

    logger.info('Total items count fetched successfully');
    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.itemsCountFetched'),
      data: { totalItems },
    });
  } catch (error: unknown) {
    logger.error(`Error fetching items count: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const setItemInactive = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { itemId } = req.body; // Extract itemId from route parameters

    // Check if the item exists
    const item = await Item.findByPk(itemId);
    if (!item) {
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('error.itemNotFound'),
      });
    }

    // Update the item's status to inactive
    await item.update({ status: 'inactive' });

    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('admin.itemStatusUpdated'),
    });
  } catch (error: unknown) {
    logger.error(`Error setting item as inactive: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};

export const updateItem = async (req: Request, res: Response): Promise<Response> => {
  const { id , description, type, quantity, quantityUnit, price, startDate, endDate } = req.body;
  const image = req.file?.buffer; // Get the binary data of the uploaded image
  const status = req.body.status || 'active'; // Default status to 'active' if not provided
  const currency = req.body.currency || 'INR'; // Default currency to 'INR' if not provided

  // Validate the request body
  const { error } = updateItemValidation.validate({id,
    description,
    type,
    quantity,
    quantityUnit,
    price,
    currency,
    startDate,
    endDate,
  });
  if (error) {
    logger.error(`Validation error: ${error.details[0].message}`);
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('error.validationError'),
    });
  }

  // Validate and convert startDate and endDate to Unix timestamps
  const startDateUnix = moment(startDate, 'DD-MM-YYYY', true);
  const endDateUnix = moment(endDate, 'DD-MM-YYYY', true);

  if (!startDateUnix.isValid() || !endDateUnix.isValid()) {
    logger.error('Invalid date format. Expected format is dd-mm-yyyy.');
    return res.status(statusCodes.BAD_REQUEST).json({
      message: getMessage('error.invalidDateFormat'),
    });
  }

  const transaction: Transaction = await sequelize.transaction();

  try {
    // Check if the item exists
    const item = await Item.findByPk(id, { transaction });
    if (!item) {
      logger.warn(`Item with ID "${id}" not found`);
      return res.status(statusCodes.NOT_FOUND).json({
        message: getMessage('item.itemNotFound'),
      });
    }

    // Update the item details
    await item.update(
      {
        description: description || item.description,
        type: type || item.type,
        quantity: quantity || item.quantity,
        quantityUnit: quantityUnit || item.quantityUnit,
        image: image || item.image, // Update image if provided
        status: status || item.status,
      },
      { transaction }
    );

    // Update the pricing details
    const pricing = await Pricing.findOne({ where: { itemId: item.id }, transaction });
    if (pricing) {
      await pricing.update(
        {
          price: price || pricing.price,
          currency: currency || pricing.currency,
          startDate: startDateUnix.unix() || pricing.startDate, // Update startDate if provided
          endDate: endDateUnix.unix() || pricing.endDate, // Update endDate if provided
          status: status || pricing.status,
        },
        { transaction }
      );
    }

    // Commit the transaction
    await transaction.commit();

    logger.info(`Item updated successfully: ${id || item.id}`);
    return res.status(statusCodes.SUCCESS).json({
      message: getMessage('success.itemUpdated'),
      data: { item, pricing },
    });
  } catch (error: unknown) {
    // Rollback the transaction in case of an error
    await transaction.rollback();

    if (error instanceof Error) {
      logger.error(`Error updating item: ${error.message}`);
    } else {
      logger.error(`Unknown error updating item: ${error}`);
    }

    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: getMessage('error.internalServerError'),
    });
  }
};