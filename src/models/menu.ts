import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import moment from 'moment-timezone'; // Import moment-timezone
moment.tz('Asia/Kolkata')
import MenuConfiguration from './menuConfiguration';
import MenuItem from './menuItem';
import Canteen from './canteen'; // Import the Canteen model

class Menu extends Model {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public startTime!: number;
  public endTime!: number;
  public status!: string;
  public canteenId!: number; // Foreign key to Canteen
  public createdById!: number | null;
  public updatedById!: number | null;
  public createdAt!: number;
  public updatedAt!: number;
}

Menu.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    startTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
    },
    canteenId: {
      type: DataTypes.INTEGER,
      allowNull: false, // Ensure every menu is associated with a canteen
      references: {
        model: Canteen, // Reference the Canteen model
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    menuConfigurationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: MenuConfiguration,
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updatedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => Math.floor(Date.now() / 1000),
    },
    updatedAt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => Math.floor(Date.now() / 1000),
    },
  },
  {
    sequelize,
    modelName: 'Menu',
    tableName: 'menus',
    timestamps: true,
    hooks: {
      beforeCreate: (menu) => {
        const now = Math.floor(Date.now() / 1000);
        menu.createdAt = now;
        menu.updatedAt = now;

        // Convert startTime and endTime to Unix timestamps
        menu.startTime = moment(menu.startTime, 'HH:mm').unix();
        menu.endTime = moment(menu.endTime, 'HH:mm').unix();
      },
      beforeUpdate: (menu) => {
        menu.updatedAt = Math.floor(Date.now() / 1000);

        // Convert startTime and endTime to Unix timestamps
        menu.startTime = moment(menu.startTime, 'HH:mm').unix();
        menu.endTime = moment(menu.endTime, 'HH:mm').unix();
      },
    },
  }
);

// Define associations
// Menu.belongsTo(Canteen, { foreignKey: 'canteenId', as: 'canteen' });
// Menu.belongsTo(MenuConfiguration, { foreignKey: 'menuConfigurationId', as: 'menuConfiguration' });
// Menu.hasMany(MenuItem, { foreignKey: 'menuId', as: 'menuItems' });

export default Menu;