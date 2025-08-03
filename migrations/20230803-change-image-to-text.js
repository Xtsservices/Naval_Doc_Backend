'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Convert BYTEA to TEXT using encode (if storing base64)
    await queryInterface.sequelize.query(`
      ALTER TABLE "items"
      ALTER COLUMN "image" TYPE TEXT
      USING encode("image", 'base64')
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Convert TEXT back to BYTEA (if needed)
    await queryInterface.sequelize.query(`
      ALTER TABLE "items"
      ALTER COLUMN "image" TYPE BYTEA
      USING decode("image", 'base64')
    `);
  },
};