import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class Wallet extends Model {
  public id!: number;
  public userId!: string;
  public referenceId!: string; // Reference ID (e.g., orderId)
  public type!: 'credit' | 'debit'; // Transaction type
  public amount!: number; // Transaction amount
  public createdAt!: number; // Unix timestamp for creation
  public updatedAt!: number; // Unix timestamp for updates
}

Wallet.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    referenceId: {
      type: DataTypes.STRING,
      allowNull: false, // Reference to the orderId
    },
    type: {
      type: DataTypes.ENUM('credit', 'debit'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.INTEGER, // Store as Unix timestamp
      allowNull: false,
      defaultValue: () => Math.floor(Date.now() / 1000), // Default to current Unix timestamp
    },
    updatedAt: {
      type: DataTypes.INTEGER, // Store as Unix timestamp
      allowNull: false,
      defaultValue: () => Math.floor(Date.now() / 1000), // Default to current Unix timestamp
    },
  },
  {
    sequelize,
    modelName: 'Wallet',
    tableName: 'wallets',
    timestamps: false, // Disable Sequelize's default timestamps
    hooks: {
      beforeUpdate: (wallet) => {
        wallet.updatedAt = Math.floor(Date.now() / 1000); // Update `updatedAt` to current Unix timestamp
      },
    },
  }
);

export default Wallet;