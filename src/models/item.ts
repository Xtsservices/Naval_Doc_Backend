import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import Pricing from './pricing';


class Item extends Model {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public type!: string; // Type of the item (e.g., 'veg', 'non-veg')
  public status!: string; // Status of the item (e.g., 'active', 'inactive')
  public quantity!: number; // Quantity of the item
  public quantityUnit!: string; // Unit of the quantity (e.g., 'ml', 'grams')
  public image!: Buffer | null; // Binary data for the image
  public createdById!: number | null;
  public updatedById!: number | null;
  public createdAt!: number; // Unix timestamp
  public updatedAt!: number; // Unix timestamp
    pricing: any;
}

Item.init(
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
    type: {
      type: DataTypes.ENUM('veg', 'non-veg'), // Restrict to 'veg' or 'non-veg'
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active', // Default status is 'active'
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0, // Default quantity is 0
    },
    quantityUnit: {
      type: DataTypes.ENUM('ml', 'grams','pieces'), // Restrict to 'ml' or 'grams'
      allowNull: false,
    },
    image: {
      type: DataTypes.BLOB('long'), // Store binary data for the image
      allowNull: true,
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
      defaultValue: () => Math.floor(Date.now() / 1000), // Unix timestamp
    },
    updatedAt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => Math.floor(Date.now() / 1000), // Unix timestamp
    },
  },
  {
    sequelize,
    modelName: 'Item',
    tableName: 'items',
    timestamps: true,
    hooks: {
      beforeCreate: (item) => {
        const now = Math.floor(Date.now() / 1000);
        item.createdAt = now;
        item.updatedAt = now;
      },
      beforeUpdate: (item) => {
        item.updatedAt = Math.floor(Date.now() / 1000);
      },
    },
  }
);
// Item.hasOne(Pricing, { foreignKey: 'itemId', as: 'pricing' });


export default Item;