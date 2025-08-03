import Joi from 'joi';
import { messages } from '../common/messages';
import dotenv from 'dotenv';

dotenv.config();

// Get the configured language from the environment variable
const language = (process.env.LANGUAGE || 'EN') as keyof typeof messages;

// Validation for login with mobile
export const loginWithMobileValidation = Joi.object({
  mobile: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': messages[language].validation.mobileInvalid,
      'any.required': messages[language].validation.mobileRequired,
    }),
});

// Validation
//  for verifying OTP
export const verifyOtpValidation = Joi.object({
  mobile: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': messages[language].validation.mobileInvalid,
      'any.required': messages[language].validation.mobileRequired,
    }),
  otp: Joi.string()
    .length(6)
    .required()
    .messages({
      'string.length': messages[language].validation.otpInvalid,
      'any.required': messages[language].validation.otpRequired,
    }),
});

// Validation for resending OTP
export const resendOtpValidation = Joi.object({
  mobile: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': messages[language].validation.mobileInvalid,
      'any.required': messages[language].validation.mobileRequired,
    }),
});

// Validation for creating a canteen
export const createCanteenValidation = Joi.object({
  canteenName: Joi.string().required().messages({
    'string.empty': messages[language].canteen.nameRequired,
  }),
  canteenCode: Joi.string().required().messages({
    'string.empty': messages[language].canteen.codeRequired,
  }),

  firstName: Joi.string().required().messages({
    'string.empty': messages[language].admin.firstNameRequired,
  }),
  lastName: Joi.string().required().messages({
    'string.empty': messages[language].admin.lastNameRequired,
  }),
  email: Joi.string().email().required().messages({
    'string.empty': messages[language].admin.emailRequired,
    'string.email': messages[language].admin.emailInvalid,
  }),
  //  gender: Joi.string().required().messages({
  //   'string.empty': messages[language].admin.genderInvalid || 'Gender is required.',
  // }),
  mobile: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.empty': messages[language].admin.mobileRequired,
      'string.pattern.base': messages[language].admin.mobileInvalid,
    }),
});

export const createItemValidation = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': messages[language].validation.nameRequired || 'Name is required.',
    'any.required': messages[language].validation.nameRequired || 'Name is required.',
  }),
  description: Joi.string().required().messages({
    'string.empty': messages[language].validation.nameRequired || 'Name is required.',
    'any.required': messages[language].validation.nameRequired || 'Name is required.',
  }),
  currency: Joi.string().required().messages({
    'string.empty': messages[language].validation.nameRequired || 'Name is required.',
    'any.required': messages[language].validation.nameRequired || 'Name is required.',
  }),

  
  type: Joi.string().valid('veg', 'non-veg').required().messages({
    'any.only': messages[language].validation.typeInvalid || 'Type must be either "veg" or "non-veg".',
    'any.required': messages[language].validation.typeInvalid || 'Type is required.',
  }),
  quantity: Joi.number().integer().min(0).required().messages({
    'number.base': messages[language].validation.quantityRequired || 'Quantity must be a number.',
    'number.min': messages[language].validation.quantityRequired || 'Quantity must be at least 0.',
    'any.required': messages[language].validation.quantityRequired || 'Quantity is required.',
  }),
  quantityUnit: Joi.string().valid('ml', 'grams','pieces','cups','packets','plates').required().messages({
    'any.only': messages[language].validation.quantityUnitInvalid || 'Quantity unit must be either "ml" or "grams" or "cups" or "packets" or "plates".',
    'any.required': messages[language].validation.quantityUnitInvalid || 'Quantity unit is required.',
  }),
  price: Joi.number().positive().required().messages({
    'number.base': messages[language].validation.priceRequired || 'Price must be a number.',
    'number.positive': messages[language].validation.priceRequired || 'Price must be greater than 0.',
    'any.required': messages[language].validation.priceRequired || 'Price is required.',
  }),
  startDate: Joi.string().required().required().messages({
    'number.base': messages[language].validation.startDateRequired || 'Start date must be a Unix timestamp.',
    'any.required': messages[language].validation.startDateRequired || 'Start date is required.',
  }),
  endDate: Joi.string().required().required().messages({
    'number.base': messages[language].validation.endDateRequired || 'End date must be a Unix timestamp.',
    'any.required': messages[language].validation.endDateRequired || 'End date is required.',
  }),
});


export const updateItemValidation = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    'empty': messages[language].validation.IDRequired || 'id is required.',
    'any.required': messages[language].validation.IDRequired || 'id is required.',
  }),
 
  
  description: Joi.string().required().messages({
    'string.empty': messages[language].validation.nameRequired || 'Name is required.',
    'any.required': messages[language].validation.nameRequired || 'Name is required.',
  }),
  currency: Joi.string().required().messages({
    'string.empty': messages[language].validation.nameRequired || 'Name is required.',
    'any.required': messages[language].validation.nameRequired || 'Name is required.',
  }),

  image:Joi.string(),
  type: Joi.string().valid('veg', 'non-veg').required().messages({
    'any.only': messages[language].validation.typeInvalid || 'Type must be either "veg" or "non-veg".',
    'any.required': messages[language].validation.typeInvalid || 'Type is required.',
  }),
  quantity: Joi.number().integer().min(0).required().messages({
    'number.base': messages[language].validation.quantityRequired || 'Quantity must be a number.',
    'number.min': messages[language].validation.quantityRequired || 'Quantity must be at least 0.',
    'any.required': messages[language].validation.quantityRequired || 'Quantity is required.',
  }),
  quantityUnit: Joi.string().valid('ml', 'grams','pieces','cups','packets','plates').required().messages({
    'any.only': messages[language].validation.quantityUnitInvalid || 'Quantity unit must be either "ml" or "grams" or "cups" or "packets" or "plates".',
    'any.required': messages[language].validation.quantityUnitInvalid || 'Quantity unit is required.',
  }),
  price: Joi.number().positive().required().messages({
    'number.base': messages[language].validation.priceRequired || 'Price must be a number.',
    'number.positive': messages[language].validation.priceRequired || 'Price must be greater than 0.',
    'any.required': messages[language].validation.priceRequired || 'Price is required.',
  }),
  startDate: Joi.string().required().required().messages({
    'number.base': messages[language].validation.startDateRequired || 'Start date must be a Unix timestamp.',
    'any.required': messages[language].validation.startDateRequired || 'Start date is required.',
  }),
  endDate: Joi.string().required().required().messages({
    'number.base': messages[language].validation.endDateRequired || 'End date must be a Unix timestamp.',
    'any.required': messages[language].validation.endDateRequired || 'End date is required.',
  }),
});