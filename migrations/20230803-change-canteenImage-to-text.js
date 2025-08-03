'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('canteens', 'canteenImage', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('canteens', 'canteenImage', {
      type: Sequelize.BLOB,
      allowNull: true,
    });
  },
};
