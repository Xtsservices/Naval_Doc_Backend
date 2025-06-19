import { sequelize } from '../config/database';
import { DataTypes } from 'sequelize';
import User from './user';
import Role from './role';
import UserRole from './userRole';
import Cart from './cart';
import CartItem from './cartItem';
import Item from './item';
import Pricing from './pricing';

// Initialize models
User.init({}, { sequelize });
Role.init(
  {
	// Define attributes for Role model
	id: {
	  type: DataTypes.INTEGER,
	  primaryKey: true,
	  autoIncrement: true,
	},
	name: {
	  type: DataTypes.STRING,
	  allowNull: false,
	},
  },
  { sequelize }
);
UserRole.init(
  {
	// Define attributes for UserRole model
	userId: {
	  type: DataTypes.INTEGER,
	  allowNull: false,
	},
	roleId: {
	  type: DataTypes.INTEGER,
	  allowNull: false,
	},
  },
  { sequelize }
 );
// Cart.init(
//   {
// 	// Define attributes for Cart model
// 	id: {
// 	  type: DataTypes.INTEGER,
// 	  primaryKey: true,
// 	  autoIncrement: true,
// 	},
// 	userId: {
// 	  type: DataTypes.INTEGER,
// 	  allowNull: false,
// 	},
//   },
//   { sequelize }
// );
// CartItem.init(
//   {
// 	// Define attributes for CartItem model
// 	id: {
// 	  type: DataTypes.INTEGER,
// 	  primaryKey: true,
// 	  autoIncrement: true,
// 	},
// 	cartId: {
// 	  type: DataTypes.INTEGER,
// 	  allowNull: false,
// 	},
// 	itemId: {
// 	  type: DataTypes.INTEGER,
// 	  allowNull: false,
// 	},
// 	quantity: {
// 	  type: DataTypes.INTEGER,
// 	  allowNull: false,
// 	},
//   },
//   { sequelize }
// );


// Define associations
// Role.hasMany(User, { foreignKey: 'roleId', as: 'users' });
// User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

// User.belongsToMany(Role, { through: UserRole, foreignKey: 'userId' });
// Role.belongsToMany(User, { through: UserRole, foreignKey: 'roleId' });

// Cart associations
// Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'cartItems' });
// CartItem.belongsTo(Cart, { foreignKey: 'cartId' });

// // CartItem associations
// CartItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
// Item.hasMany(CartItem, { foreignKey: 'itemId' });

// // Pricing associations
// Item.hasOne(Pricing, { foreignKey: 'itemId', as: 'pricing' }); // Keep this alias
// Pricing.belongsTo(Item, { foreignKey: 'itemId', as: 'pricingItem' }); // Use a unique alias

// Cart.init(
//   {
// 	// Define attributes for Cart model
// 	id: {
// 	  type: DataTypes.INTEGER,
// 	  primaryKey: true,
// 	  autoIncrement: true,
// 	},
// 	userId: {
// 	  type: DataTypes.INTEGER,
// 	  allowNull: false,
// 	},
//   },
//   { sequelize }
// );
// CartItem.init(
//   {
// 	// Define attributes for CartItem model
// 	id: {
// 	  type: DataTypes.INTEGER,
// 	  primaryKey: true,
// 	  autoIncrement: true,
// 	},
// 	cartId: {
// 	  type: DataTypes.INTEGER,
// 	  allowNull: false,
// 	},
// 	itemId: {
// 	  type: DataTypes.INTEGER,
// 	  allowNull: false,
// 	},
// 	quantity: {
// 	  type: DataTypes.INTEGER,
// 	  allowNull: false,
// 	},
//   },
//   { sequelize }
// );
// Define associations
// Role.hasMany(User, { foreignKey: 'roleId', as: 'users' });
// User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
// User.belongsToMany(Role, { through: UserRole, foreignKey: 'userId' });
// Role.belongsToMany(User, { through: UserRole, foreignKey: 'roleId' });
// Cart associations
// Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'cartItems' });
// CartItem.belongsTo(Cart, { foreignKey: 'cartId' });
// // CartItem associations
// CartItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
// Item.hasMany(CartItem, { foreignKey: 'itemId' });
// // Pricing associations
// Item.hasOne(Pricing, { foreignKey: 'itemId', as: 'pricing' }); // Keep this alias
// Pricing.belongsTo(Item, { foreignKey: 'itemId', as: 'pricingItem' }); // Use a unique alias
export { sequelize, User, Role, UserRole, Cart, CartItem, Item, Pricing };