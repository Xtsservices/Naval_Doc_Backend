import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';
import moment from 'moment-timezone'; // Import moment-timezone
moment.tz('Asia/Kolkata')

class Payment extends Model {
  public id!: number;
  public orderId!: number;
  public userId!: number;
  public paymentMethod!: string;
  public transactionId!: string | null;
  public amount!: number;
  public gatewayPercentage!: number;
  public gatewayCharges!: number;
  public totalAmount!: number;
  public currency!: string;
  public status!: string;
  public createdById!: number; // ID of the user who created the payment
  public updatedById!: number; // ID of the user who last updated the payment
  public readonly createdAt!: number; // Store as Unix timestamp
  public readonly updatedAt!: number; // Store as Unix timestamp
}

Payment.init(
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
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    gatewayPercentage: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    gatewayCharges: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    totalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
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
    tableName: 'payments',
    timestamps: true, // Enable Sequelize timestamps
  }
);

export default Payment;
