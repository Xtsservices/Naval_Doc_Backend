import { Request, Response } from 'express';
import User from '../models/user';
import Otp from '../models/otp';
import { generateOtp, generateToken, getExpiryTimeInKolkata, getMessage } from '../common/utils';
import {
  loginWithMobileValidation,
  verifyOtpValidation,
  resendOtpValidation,
} from '../validations/joiValidations';
import sequelize from '../config/database'; // Import sequelize for transaction management
import { responseHandler } from '../common/responseHandler';
import { statusCodes } from '../common/statusCodes';
import logger from '../common/logger';

export const loginWithMobile = async (req: Request, res: Response) => {
  const { mobile } = req.body;

  const { error } = loginWithMobileValidation.validate({ mobile });

  if (error) {
    logger.error(`Validation error: ${error.details[0].message}`);
    return res
      .status(statusCodes.BAD_REQUEST)
      .json({ message: getMessage('validation.mobileRequired') });
  }

  const transaction = await sequelize.transaction(); // Start a transaction

  try {
    let user = await User.findOne({ where: { mobile }, transaction });
    if (!user) {
      user = await User.create({ mobile }, { transaction });
    }

    const otp = generateOtp(); // Generate OTP
    const expiresAt = getExpiryTimeInKolkata(60); // Set expiry time to 60 seconds from now

    await Otp.create({ mobile, otp, expiresAt }, { transaction }); // Save OTP with expiry time in the database

    await transaction.commit(); // Commit the transaction

    logger.info(`OTP generated for mobile ${mobile}: ${otp}`); // Log OTP generation

    res
      .status(statusCodes.SUCCESS)
      .json({ message: getMessage('success.otpSent') });
  } catch (error: unknown) {
    await transaction.rollback(); // Rollback the transaction in case of an error

    if (error instanceof Error) {
      logger.error(`Error in loginWithMobile: ${error.message}`);
    } else {
      logger.error(`Unknown error in loginWithMobile: ${error}`);
    }

    res
      .status(statusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: getMessage('error.internalServerError') });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { mobile, otp } = req.body;

  const { error } = verifyOtpValidation.validate({ mobile, otp });

  if (error) {
    logger.error(`Validation error: ${error.details[0].message}`);
    return res
      .status(statusCodes.BAD_REQUEST)
      .json({ message: error.details[0].message });
  }

  const transaction = await sequelize.transaction(); // Start a transaction

  try {
    const otpRecord = await Otp.findOne({ where: { mobile, otp }, transaction });

    if (!otpRecord) {
      logger.warn(`Invalid OTP for mobile ${mobile}`);
      await transaction.rollback(); // Rollback the transaction
      return res
        .status(statusCodes.BAD_REQUEST)
        .json({ message: responseHandler.validation.invalidOtp.message });
    }

    // Check if the OTP has expired
    const currentTime = Math.floor(Date.now() / 1000); // Current time in Unix timestamp
    if (currentTime > otpRecord.expiresAt) {
      logger.warn(`Expired OTP for mobile ${mobile}`);
      await otpRecord.destroy({ transaction }); // Delete the expired OTP
      await transaction.rollback(); // Rollback the transaction
      return res
        .status(statusCodes.BAD_REQUEST)
        .json({ message: getMessage('validation.otpExpired') });
    }

    // OTP is valid, delete the OTP record
    await otpRecord.destroy({ transaction });

    // Generate a JWT token using the utility function
    const token = generateToken({ mobile });

    await transaction.commit(); // Commit the transaction

    logger.info(`OTP verified for mobile ${mobile}`);
    res
      .status(statusCodes.SUCCESS)
      .json({ message: responseHandler.success.otpVerified.message, token });
  } catch (error: unknown) {
    await transaction.rollback(); // Rollback the transaction in case of an error

    if (error instanceof Error) {
      logger.error(`Error in verifyOtp: ${error.message}`);
    } else {
      logger.error(`Unknown error in verifyOtp: ${error}`);
    }

    res
      .status(statusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: responseHandler.error.internalServerError.message });
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  const { mobile } = req.body;

  const { error } = resendOtpValidation.validate({ mobile });

  if (error) {
    logger.error(`Validation error: ${error.details[0].message}`);
    return res
      .status(statusCodes.BAD_REQUEST)
      .json({ message: error.details[0].message });
  }

  try {
    const otp = generateOtp(); // Generate a new OTP
    const expiresAt = getExpiryTimeInKolkata(60); // Set expiry time to 60 seconds from now

    const otpRecord = await Otp.findOne({ where: { mobile } });
    if (otpRecord) {
      otpRecord.otp = otp;
      otpRecord.expiresAt = expiresAt; // Update expiry time
      await otpRecord.save();
    } else {
      await Otp.create({ mobile, otp, expiresAt });
    }

    logger.info(`Resent OTP for mobile ${mobile}: ${otp}`); // Log OTP resend

    res
      .status(statusCodes.SUCCESS)
      .json({ message: responseHandler.success.otpResent.message });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error in resendOtp: ${error.message}`);
    } else {
      logger.error(`Unknown error in resendOtp: ${error}`);
    }
    res
      .status(statusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: responseHandler.error.internalServerError.message });
  }
};