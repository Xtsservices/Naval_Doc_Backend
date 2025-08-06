import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Validate DATABASE_URL to prevent connection failures
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  // Enable logging in development mode for debugging slow queries or errors
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 20,          // Reduced to avoid overloading database (prevents Operation timeout)
    min: 2,           // Lower minimum to reduce idle connections
    acquire: 30000,   // 30 seconds to acquire connection (faster timeout for Operation timeout errors)
    idle: 30000,      // 30 seconds before closing idle connections
    evict: 5000,      // Check idle connections every 5 seconds (less aggressive than 1s)
    maxUses: 100,     // Close connection after 100 uses to prevent stale connections
  },
  retry: {
    max: 3,           // Retry failed connections up to 3 times
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeConnectionTimedOutError/,
    ],                // Retry only on specific connection errors
    backoffBase: 100, // Initial delay of 100ms
    backoffExponent: 1.5, // Exponential backoff for retries
  },
  dialectOptions: {
    statement_timeout: 10000, // 10 seconds per query to prevent long-running queries
  },
});

// Validate database connection on startup
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}
initializeDatabase().catch((error) => {
  console.error('Database initialization failed:', error);
  process.exit(1); // Exit process on failure to ensure the app doesn't run with a bad connection
});

// Monitor connection pool periodically (optional, for debugging)
setInterval(() => {
  console.log('Pool stats:', {
    acquired: sequelize.connectionManager.pool.size,
    idle: sequelize.connectionManager.pool.idle,
    waiting: sequelize.connectionManager.pool.waiting,
  });
}, 60000); // Log every minute to detect pool exhaustion

// Import models
import '../models/item';
import '../models/pricing';

// Import and define associations
import { defineAssociations } from '../models/associations';
defineAssociations();

export { sequelize };