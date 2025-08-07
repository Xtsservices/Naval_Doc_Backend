// import { Sequelize } from 'sequelize';

// import dotenv from 'dotenv';
// dotenv.config(); // Load environment variables from .env file


// const sequelize = new Sequelize(process.env.DATABASE_URL || '', {
//   dialect: 'postgres',
//   logging: false, // Enable logging for debugging
//   pool: {
//     max: 50,         // Maximum number of connections in pool
//     min: 5,          // Minimum number of connections in pool
//     acquire: 60000,  // Max time (ms) that pool will try to get connection before throwing error
//     idle: 10000,
//     evict: 1000, // Helps clean idle ones
//   },
//   retry: {
//     max: 3 // Retry connection 3 times if it fails
//   },
// });

// // Import models
// import '../models/item';
// import '../models/pricing';

// // Import and define associations
// import { defineAssociations } from '../models/associations';
// defineAssociations();

// export { sequelize };






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
  benchmark: true, // ✅ Enables timing for each query
  logging: (sql, timeTaken?: number) => {
   if (timeTaken !== undefined && timeTaken > 500) {
    console.warn(`[SLOW QUERY > 500ms] (${timeTaken} ms): ${sql}`);
  }
  },
  pool: {
    max: 30,
    min: 2,
    acquire: 60000,
    idle: 30000,
    evict: 5000,
    maxUses: 100,
  },
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeConnectionTimedOutError/,
    ],
    backoffBase: 100,
    backoffExponent: 1.5,
  },
  dialectOptions: {
    statement_timeout: 10000,
  },
});


// Validate database connection on startup
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    if (
      typeof error === 'object' &&
      error !== null &&
      'parent' in error &&
      typeof (error as any).parent === 'object' &&
      (error as any).parent !== null &&
      'code' in (error as any).parent &&
      (error as any).parent.code === '3D000'
    ) {
      console.error(
        `Database "${(process.env.DATABASE_URL ?? '').split('/').pop()}" does not exist. ` +
        'Please create the database using the following command in PostgreSQL:\n' +
        `  CREATE DATABASE ${(process.env.DATABASE_URL ?? '').split('/').pop()};`
      );
    }
    throw error;
  }
}
initializeDatabase().catch((error) => {
  console.error('Database initialization failed:', error);
  process.exit(1); // Exit process on failure to ensure the app doesn't run with a bad connection
});

// Optional: Automatically create database if it doesn't exist (uncomment if needed)
/*
async function createDatabaseIfNotExists() {
  const urlParts = process.env.DATABASE_URL.split('/');
  const dbName = urlParts.pop();
  const baseUrl = urlParts.join('/') + '/postgres'; // Connect to default 'postgres' database
  const tempSequelize = new Sequelize(baseUrl, {
    dialect: 'postgres',
    logging: false,
  });
  try {
    await tempSequelize.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created successfully`);
  } catch (error) {
    if (error.parent && error.parent.code === '42P04') {
      console.log(`Database "${dbName}" already exists`);
    } else {
      console.error('Failed to create database:', error);
    }
  } finally {
    await tempSequelize.close();
  }
}
// Run database creation before authentication
createDatabaseIfNotExists().then(() => initializeDatabase()).catch((error) => {
  console.error('Database setup failed:', error);
  process.exit(1);
});
*/

// Monitor connection pool periodically (optional, for debugging)
setInterval(() => {
  // Use type assertion to bypass TypeScript error for pool properties
  const pool = (sequelize.connectionManager as any).pool;
  if (pool) {
    console.log('Pool stats:', {
      acquired: pool.size || 0,    // Total connections in use
      available: pool.available || 0, // Available (idle) connections
      waiting: pool.waiting || 0,  // Requests waiting for a connection
    });
  } else {
    console.log('Pool stats: Pool not available');
  }
}, 60000); // Log every minute to detect pool exhaustion

// Import models
import '../models/item';
import '../models/pricing';

// Import and define associations
import { defineAssociations } from '../models/associations';
defineAssociations();

export { sequelize };