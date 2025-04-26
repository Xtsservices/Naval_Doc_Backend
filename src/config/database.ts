import { Sequelize } from 'sequelize';

import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file


const sequelize = new Sequelize(process.env.DATABASE_URL || '', {
  dialect: 'postgres',
  logging: console.log, // Enable logging for debugging
});

// Import models
import '../models/item';
import '../models/pricing';

// Import and define associations
import { defineAssociations } from '../models/associations';
defineAssociations();

export { sequelize };