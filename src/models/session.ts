import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';

class Session extends Model {}

Session.init(
  {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    token: { type: DataTypes.STRING, allowNull: false },
    loginTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    logoutTime: { type: DataTypes.DATE, allowNull: true },
    
    // Add more fields as needed (e.g., deviceInfo, ipAddress)
  },
  { sequelize, modelName: 'Session', tableName: 'sessions' }
);

export default Session;