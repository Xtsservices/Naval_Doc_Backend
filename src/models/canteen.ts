import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class Canteen extends Model {}
Canteen.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    canteenName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    canteenCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    canteenImage: {
      type: DataTypes.TEXT,
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
    modelName: 'Canteen',
    tableName: 'canteens',
    timestamps: false,
  }
);

export default Canteen;