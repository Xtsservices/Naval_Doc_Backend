import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';
import moment from 'moment-timezone'; // Import moment-timezone
moment.tz('Asia/Kolkata')

class OrderItem extends Model {
  public id!: number;
  public orderId!: number;
  public itemId!: number;
  public quantity!: number;
  public price!: number;
  public total!: number;
  public createdById!: number; // ID of the user who created the order item
  public updatedById!: number; // ID of the user who last updated the order item
  public readonly createdAt!: number; // Store as Unix timestamp
  public readonly updatedAt!: number; // Store as Unix timestamp
}

OrderItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    itemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    total: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: false, // Ensure this field is required
    },
    updatedById: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow null for updates
    },
    createdAt: {
      type: DataTypes.DATE,
      get() {
        return moment(this.getDataValue('createdAt')).unix(); // Convert to Unix timestamp
      },
    },
    updatedAt: {
      type: DataTypes.DATE,
      get() {
        return moment(this.getDataValue('updatedAt')).unix(); // Convert to Unix timestamp
      },
    },
  },
  {
    sequelize,
    tableName: 'order_items',
    timestamps: true, // Enable Sequelize timestamps
  }
);

export default OrderItem;