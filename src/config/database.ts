import { Sequelize } from 'sequelize';

import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file


const sequelize = new Sequelize(process.env.DATABASE_URL || '', {
  dialect: 'postgres',
  logging: false, // Enable logging for debugging
  pool: {
    max: 50,         // Maximum number of connections in pool
    min: 5,          // Minimum number of connections in pool
    acquire: 60000,  // Max time (ms) that pool will try to get connection before throwing error
    idle: 10000,
    evict: 1000, // Helps clean idle ones
  },
  retry: {
    max: 3 // Retry connection 3 times if it fails
  },
});

// Import models
import '../models/item';
import '../models/pricing';

// Import and define associations
import { defineAssociations } from '../models/associations';
defineAssociations();

export { sequelize };