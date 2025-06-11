import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import moment from 'moment-timezone'; // Import moment-timezone
moment.tz('Asia/Kolkata')
import userRole from './userRole';

class User extends Model {
  public id!: number;
  public firstName!: string;
  public lastName!: string;
  public email!: string;
  public mobile!: string;
  public canteenId!: number | null;
  public createdById!: number | null;
  public updatedById!: number | null;
  public createdAt!: number; // Unix timestamp
  public updatedAt!: number; // Unix timestamp

  // Convert Unix timestamps to human-readable dates

}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    mobile: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    canteenId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'canteens', // Table name of the Canteen model
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
      type: DataTypes.INTEGER, // Store as Unix timestamp
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.INTEGER, // Store as Unix timestamp
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true, // Automatically manages createdAt and updatedAt
    hooks: {
      beforeCreate: (user) => {
        const now = moment().unix(); // Current Unix timestamp
        user.createdAt = now;
        user.updatedAt = now;
      },
      beforeUpdate: (user) => {
        user.updatedAt = moment().unix(); // Current Unix timestamp
      },
    },
  }
);
export default User;