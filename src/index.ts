import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';

import authRoutes from './routes/authRoutes';
import canteenRoutes from './routes/canteenRoutes';
import userRoutes from './routes/userRoutes';
import itemRoutes from './routes/itemRoutes';
import menuConfigurationRoutes from './routes/menuConfigurationRoutes';
import menuRoutes from './routes/menuRoutes';
import orderRoutes from './routes/orderRoutes';
import adminDashboardRoutes from './routes/adminDashboardRoutes';
import voiceRoutes from './routes/voiceRoutes';
import paymentSdkRoutes from './routes/paymentSdkRoutes'; // Import payment SDK routes
import { Buffer } from 'buffer';
import base64 from 'base-64'; // Install via: npm install base-64





import dotenv from 'dotenv';
import { DataTypes } from 'sequelize';
import cors from 'cors';
import { sequelize } from './config/database'; // Updated import
import User from './models/user';
import UserRole from './models/userRole';
import Role from './models/role';

import Menu from './models/menu';
import MenuItem from './models/menuItem';
import Item from './models/item';
import MenuConfiguration from './models/menuConfiguration';
import Canteen from './models/canteen';
import cartRoutes from './routes/cartRoutes';
import Pricing from './models/pricing';
import CartItem from './models/cartItem'; // Import CartItem
import Cart from './models/cart'; // Import Cart
import Order from './models/order';
import OrderItem from './models/orderItem';
import Payment from './models/payment';
import axios from 'axios';

import { v4 as uuidv4 } from 'uuid';

import crypto from 'crypto';
import { getTotalAmount } from './controllers/adminDashboardController';
import { PaymentLink } from './common/utils';

const AIRTEL_USERNAME = 'your_username'; // Replace with your HMAC username
const AIRTEL_SECRET = 'your_secret';     // Replace with your HMAC secret key
function getGMTDate(): string {
  return new Date().toUTCString();
}
function generateHMACAuth(body: any, date: string): string {
  const content = JSON.stringify(body);
  const hmac = crypto
    .createHmac('sha256', AIRTEL_SECRET)
    .update(content + date)
    .digest('base64');

  return `HMAC ${AIRTEL_USERNAME}:${hmac}`;
}







dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;

// Enable CORS
const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
};
app.use(cors(corsOptions));

// Initialize models
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
    },
  },
  { sequelize, modelName: 'User' }
);
Role.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  { sequelize, modelName: 'Role' }
);
UserRole.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  { sequelize, modelName: 'UserRole' }
);


Canteen.hasOne(User, { as: 'adminUser', foreignKey: 'canteenId' });
User.belongsTo(Canteen, { as: 'canteen', foreignKey: 'canteenId' });
// User and Role associations
User.hasMany(UserRole, { foreignKey: 'userId', as: 'userRoles' }); // Alias for User -> UserRole
UserRole.belongsTo(User, { foreignKey: 'userId', as: 'user' }); // Reverse association
UserRole.belongsTo(Role, { foreignKey: 'roleId', as: 'role' }); // Alias for UserRole -> Role
Role.hasMany(UserRole, { foreignKey: 'roleId', as: 'roleUserRoles' }); // Updated alias to avoid conflicts

// Menu and MenuItem associations
Menu.hasMany(MenuItem, { foreignKey: 'menuId', as: 'menuItems' }); // Alias for Menu -> MenuItem
MenuItem.belongsTo(Menu, { foreignKey: 'menuId', as: 'menu' }); // Reverse association
MenuItem.belongsTo(Item, { foreignKey: 'itemId', as: 'menuItemItem' }); // Updated alias to avoid conflicts

// Menu and Canteen/MenuConfiguration associations
Menu.belongsTo(Canteen, { foreignKey: 'canteenId', as: 'menuCanteen' }); // Updated alias to avoid conflicts
Menu.belongsTo(MenuConfiguration, { foreignKey: 'menuConfigurationId', as: 'menuMenuConfiguration' }); // Updated alias

// Cart and CartItem associations
Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'cartItems' }); // Alias for Cart -> CartItem
CartItem.belongsTo(Cart, { foreignKey: 'cartId', as: 'cart' }); // Reverse association

// Item and CartItem associations
Item.hasMany(CartItem, { foreignKey: 'itemId', as: 'itemCartItems' }); // Updated alias to avoid conflicts
CartItem.belongsTo(Item, { foreignKey: 'itemId', as: 'cartItemItem' }); // Updated alias to avoid conflicts

// Cart and MenuConfiguration/Canteen associations
Cart.belongsTo(MenuConfiguration, { foreignKey: 'menuConfigurationId', as: 'cartMenuConfiguration' }); // Updated alias
Cart.belongsTo(Canteen, { foreignKey: 'canteenId', as: 'cartCanteen' }); // Updated alias

// Order and User associations
// Order.belongsTo(User, { foreignKey: 'userId', as: 'orderUser' }); // Updated alias to avoid conflicts
// User.hasMany(Order, { foreignKey: 'userId', as: 'userOrders' }); // Updated alias to avoid conflicts


Order.belongsTo(User, { foreignKey: 'userId', as: 'orderUser' }); // Alias for Order -> User
User.hasMany(Order, { foreignKey: 'userId', as: 'userOrders' }); // Reverse association

// Menu and Canteen association
Menu.belongsTo(Canteen, { foreignKey: 'canteenId', as: 'canteenMenu' }); // Alias for Menu -> Canteen
Canteen.hasMany(Menu, { foreignKey: 'canteenId', as: 'canteenMenus' }); // Reverse association

// Order and Canteen association
Order.belongsTo(Canteen, { foreignKey: 'canteenId', as: 'orderCanteen' }); // Updated alias
Canteen.hasMany(Order, { foreignKey: 'canteenId', as: 'canteenOrders' }); // Reverse association


// Order and OrderItem associations
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'orderItems' }); // Alias for Order -> OrderItem
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' }); // Reverse association


// Order and Payment associations
// Order.hasOne(Payment, { foreignKey: 'orderId', as: 'payment' }); // Alias for Order -> Payment
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' }); // Reverse association
Order.hasMany(Payment, { as: 'payment', foreignKey: 'orderId' });
// OrderItem and Item associations
OrderItem.belongsTo(Item, { foreignKey: 'itemId', as: 'menuItemItem' }); // Alias for OrderItem -> Item
Item.hasMany(OrderItem, { foreignKey: 'itemId', as: 'itemOrderItems' }); // Reverse association


CartItem.belongsTo(MenuItem, { as: 'menuItem', foreignKey: 'itemId' });


// Associate Item with Pricing
Item.hasOne(Pricing, { foreignKey: 'itemId', as: 'itemPricing' }); // Associate Item with Pricing
Pricing.belongsTo(Item, { foreignKey: 'itemId', as: 'pricingItem' }); // Updated alias to avoid conflict


sequelize.sync({ force: false }).then(() => {
  console.log('Database synced successfully!');
});

app.use(express.json());
app.use('/api', authRoutes);
app.use('/api/canteen', canteenRoutes);

app.use('/api/user', userRoutes);

app.use('/api/item', itemRoutes);

app.use('/api/menu', menuRoutes);

app.use('/api/menuconfig', menuConfigurationRoutes);

app.use('/api/cart', cartRoutes);

app.use('/api/order', orderRoutes);

app.use('/api/adminDasboard', adminDashboardRoutes);

app.use('/api/voice', voiceRoutes);

//payment method sdk
app.use('/api/paymentsdk', paymentSdkRoutes);


//  const AIRTEL_API_URL = process.env.AIRTEL_API_URL!;
// const AIRTEL_TOKEN = process.env.AIRTEL_TOKEN!;
// const FROM_NUMBER = process.env.FROM_NUMBER!; // Airtel-registered number

const AIRTEL_API_URL = "https://iqwhatsapp.airtel.in/gateway/airtel-xchange/basic/whatsapp-manager/v1/session/send/text"

const FROM_NUMBER = 917337068888
const AIRTEL_TOKEN = 'T7W9&w3396Y"';

interface UserSession {
  items: string[];
  confirmed: boolean;
  menus?: { id: number; name: string }[]; // Add menus property
}

// 🔄 Webhook to receive incoming messages from Airtel
const sessions: Record<string, {
  items: any;
  selectedMenu: any;
  menus: any;
  selectedCanteen: any;
  canteens: any; city?: string; service?: string; specialization?: string; doctor?: string; date?: string; slot?: string; stage?: string; cart?: { itemId: number; name: string; price: number; quantity: number }[] 
}> = {};

const CITIES = ['Warangal', 'Karimnagar', 'Nizamabad'];
const SERVICES = ['Doctor Appointments', 'Pharmacy', 'Diagnostics', 'Blood Banks'];
const SPECIALIZATIONS = {
  'Doctor Appointments': ['Cardiologist', 'Neurology'],
};
const DOCTORS = {
  Cardiologist: ['Dr Karthik', 'Dr Spandana'],
  Neurology: ['Dr Satya', 'Dr Srikanth'],
};
const SLOTS = ['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'];

app.post('/webhook', async (req: Request, res: Response) => {
  // console.log('Received webhook request:', req.body);

  // Check if msgStatus is RECEIVED
  if (req.body.msgStatus !== 'RECEIVED') {
    console.log('Ignoring webhook request as msgStatus is not RECEIVED.');
    return res.status(200).json({ message: 'Webhook ignored.' });
  }

  // Check if recipientAddress matches the specific number
  if (req.body.recipientAddress === '918686078782') {
    console.log('Navigating to another function for processing recipientAddress:', req.body.recipientAddress);
    await processSpecialRecipient(req.body); // Navigate to another function
    return res.status(200).json({ message: 'Special recipient processed.' });
  }

  const { sourceAddress: from, messageParameters } = req.body;

  if (!from || !messageParameters?.text?.body) {
    console.error('Invalid webhook payload:', req.body);
    return res.status(400).json({ message: 'Invalid webhook payload.' });
  }

  const text = messageParameters.text.body.trim();
  console.log(`📥 Incoming message from ${from}: ${text}`);

  if (!sessions[from]) {
    sessions[from] = { items: [], selectedCanteen: null, canteens: [], menus: null, selectedMenu: null };
  }

  const session = sessions[from];
  let reply = '';

  // Handle session logic
  if (!session.city) {
    if (text.toLowerCase() === 'hi') {
      reply = `👋 Welcome to Vydhyo! Please select your city:\n${CITIES.map((city, index) => `${index + 1}) ${city}`).join('\n')}`;
    } else if (Number(text) >= 1 && Number(text) <= CITIES.length) {
      session.city = CITIES[Number(text) - 1];
      reply = `You selected ${session.city}. Please select a service:\n${SERVICES.map((service, index) => `${index + 1}) ${service}`).join('\n')}`;
    } else {
      reply = `❓ I didn't understand that. Please type 'Hi' to start or select a valid city number.`;
    }
  } else if (!session.service) {
    if (Number(text) >= 1 && Number(text) <= SERVICES.length) {
      session.service = SERVICES[Number(text) - 1];
      if (session.service === 'Doctor Appointments') {
        reply = `You selected ${session.service}. Please select a specialization:\n${SPECIALIZATIONS['Doctor Appointments'].map((spec, index) => `${index + 1}) ${spec}`).join('\n')}`;
      } else {
        reply = `You selected ${session.service}. This service is not yet implemented.`;
      }
    } else {
      reply = `❓ I didn't understand that. Please select a valid service number:\n${SERVICES.map((service, index) => `${index + 1}) ${service}`).join('\n')}`;
    }
  } else if (!session.specialization) {
    if (Number(text) >= 1 && Number(text) <= SPECIALIZATIONS['Doctor Appointments'].length) {
      session.specialization = SPECIALIZATIONS['Doctor Appointments'][Number(text) - 1];
      reply = `You selected ${session.specialization}. Please select a doctor:\n${DOCTORS[session.specialization as keyof typeof DOCTORS].map((doc, index) => `${index + 1}) ${doc}`).join('\n')}`;
    } else {
      reply = `❓ I didn't understand that. Please select a valid specialization number:\n${SPECIALIZATIONS['Doctor Appointments'].map((spec, index) => `${index + 1}) ${spec}`).join('\n')}`;
    }
  } else if (!session.doctor) {
    if (Number(text) >= 1 && Number(text) <= DOCTORS[session.specialization as keyof typeof DOCTORS].length) {
      session.doctor = DOCTORS[session.specialization as keyof typeof DOCTORS][Number(text) - 1];
      const today = new Date();
      const dates = [today, new Date(today.getTime() + 86400000), new Date(today.getTime() + 2 * 86400000)];
      reply = `You selected ${session.doctor}. Please select a date:\n${dates.map((date, index) => `${index + 1}) ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`).join('\n')}`;
    } else {
      reply = `❓ I didn't understand that. Please select a valid doctor number:\n${DOCTORS[session.specialization as keyof typeof DOCTORS].map((doc, index) => `${index + 1}) ${doc}`).join('\n')}`;
    }
  } else if (!session.date) {
    const today = new Date();
    const dates = [today, new Date(today.getTime() + 86400000), new Date(today.getTime() + 2 * 86400000)];
    if (Number(text) >= 1 && Number(text) <= dates.length) {
      session.date = dates[Number(text) - 1].toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      reply = `You selected ${session.date}. Please select a time slot:\n${SLOTS.map((slot, index) => `${index + 1}) ${slot}`).join('\n')}`;
    } else {
      reply = `❓ I didn't understand that. Please select a valid date number:\n${dates.map((date, index) => `${index + 1}) ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`).join('\n')}`;
    }
  } else if (!session.slot) {
    if (Number(text) >= 1 && Number(text) <= SLOTS.length) {
      session.slot = SLOTS[Number(text) - 1];
      reply = `You selected ${session.slot}. Confirm your appointment by replying 'Yes'.`;
    } else {
      reply = `❓ I didn't understand that. Please select a valid time slot number:\n${SLOTS.map((slot, index) => `${index + 1}) ${slot}`).join('\n')}`;
    }
  } else if (text.toLowerCase() === 'yes') {
    const appointmentId = uuidv4();
    reply = `✅ Appointment confirmed!\n\nDetails:\nCity: ${session.city}\nService: ${session.service}\nSpecialization: ${session.specialization}\nDoctor: ${session.doctor}\nDate: ${session.date}\nSlot: ${session.slot}\nAppointment ID: ${appointmentId}`;
    delete sessions[from]; // Clear session after confirmation
  } else {
    reply = `❓ I didn't understand that. Please confirm your appointment by replying 'Yes'.`;
  }

  // Send reply via Airtel API
  try {
    await sendWhatsAppMessage(from, reply, FROM_NUMBER.toString(),null);
    console.log(`📤 Reply sent to ${from}: ${reply}`);
  } catch (error: any) {
    console.error('❌ Error sending reply:', error.message);
  }

  res.status(200).json({ message: 'Webhook processed successfully.' });
});

/**
 * Function to process special recipient
 */
const processSpecialRecipient = async (body: any) => {
  const { messageParameters, sourceAddress: userId } = body;

  if (!messageParameters?.text?.body || !userId) {
    console.error('Invalid payload for special recipient:', body);
    return;
  }

  const msg = messageParameters.text.body.trim().toLowerCase();

  // Initialize session for the user if not already present
  if (!sessions[userId]) {
    sessions[userId] = { stage: 'menu_selection', items: [], cart: [], canteens: [], menus: null, selectedCanteen: null, selectedMenu: null };
  }

  const session = sessions[userId];
  let reply = '';
  let FROM_NUMBER="918686078782"
  // console.log("----------------------------");
  // console.log(session.stage, 'Session stage for user:', userId);
  // console.log("----------------------------");

  // console.log('body', msg);
  // console.log("----------------------------");

  // console.log("----------------------------");



  // Step 1: Menu Selection
  if (msg === 'hi' ) {
    session.stage = 'menu_selection';
    const canteens = await axios
      .get(`${process.env.BASE_URL}/api/canteen/getAllCanteensforwhatsapp`)
      .then(response => response.data.data || [])
      .catch(error => {
        console.error('Error fetching canteens:', error.message);
        return [];
      });

    if (canteens.length > 0) {
      session.canteens = canteens;
      const list = canteens.map((c: { canteenName: any }, idx: number) => `${idx + 1}. ${c.canteenName}`).join('\n');
      reply = `🍽️ Welcome To welfare canteen naval dock yard ! Choose a canteen:\n${list}`;
    } else {
      reply = `❌ No canteens available at the moment. Please try again later.`;
    }
    sessions[userId] = session;
    await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(), null);
    return;
  }

  // Step 2: Canteen Selection
  if (session.stage === 'menu_selection' && /^[1-9]\d*$/.test(msg)) {
    const index = parseInt(msg) - 1;
    if (index < 0 || index >= session.canteens.length) {
      reply = '⚠️ Invalid canteen option. Please type "hi" to restart.';
      await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(),null);
      return;
    }

    const selectedCanteen = session.canteens[index];
    session.selectedCanteen = selectedCanteen;
    session.stage = 'item_selection';

    const menus = await axios
      .get(`${process.env.BASE_URL}/api/menu/getMenusByCanteen?canteenId=${selectedCanteen.id}`)
      .then(response => response.data.data || [])
      .catch(error => {
        console.error('Error fetching menus:', error.message);
        return [];
      });

    if (menus.length > 0) {
      session.menus = menus;
      const menuList = menus.map((m: { name: any }, idx: number) => `${idx + 1}. ${m.name}`).join('\n');
      reply = `🍴 ${selectedCanteen.canteenName.toUpperCase()} MENU:\n${menuList}\n\nSend menu number to proceed.`;
    } else {
      reply = `❌ No menus available for ${selectedCanteen.canteenName}. Please try again later.`;
    }
    sessions[userId] = session;
    await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(),null);
    return;
  }

  // Step 3: Menu Selection
  if (session.stage === 'item_selection' && /^[1-9]\d*$/.test(msg)) {
    const index = parseInt(msg) - 1;
    if (index < 0 || index >= session.menus.length) {
      reply = '⚠️ Invalid menu option. Please type "hi" to restart.';
      await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(),null);
      return;
    }

    const selectedMenu = session.menus[index];
    session.selectedMenu = selectedMenu;
    session.stage = 'cart_selection';

    const items = await axios
      .get(`${process.env.BASE_URL}/api/menu/getMenuByIdforwhatsapp?menuId=${selectedMenu.id}`)
      .then(response => response.data.data || [])
      .catch(error => {
        console.error('Error fetching items:', error.message);
        return [];
      });

    if (items.length > 0) {
      session.items = items;
      const itemList = items.map((i: { id: any; name: any; price: any }) => `${i.id}. ${i.name} - ₹${i.price}`).join('\n');
      reply = `🛒 ${selectedMenu.name.toUpperCase()} ITEMS:\n${itemList}\n\nSend items like: 1*2,2*1`;
    } else {
      reply = `❌ No items available for ${selectedMenu.name}. Please try again later.`;
    }
    sessions[userId] = session;
    await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(),null);
    return;
  }

  // Step 4: Cart Selection
  if (session.stage === 'cart_selection' && /^\d+\*\d+(,\d+\*\d+)*$/.test(msg)) {
    const selections = msg.split(',');
    for (const pair of selections) {
      const [idStr, qtyStr] = pair.split('*');
      const id = parseInt(idStr);
      const quantity = parseInt(qtyStr);
      const item = session.items.find((i: { id: number }) => i.id === id);
      if (item) {
        session.cart = session.cart || [];
        const existing = session.cart.find(c => c.itemId === id);
        if (existing) existing.quantity = quantity;
        else session.cart.push({ itemId: id, name: item.name, price: item.price, quantity });
      }
    }
    session.stage = 'cart_review';
    sessions[userId] = session;

    const cartText = (session.cart ?? [])
      .map(c => `- ${c.name} x${c.quantity} = ₹${c.quantity * c.price}`)
      .join('\n');
    const total = (session.cart ?? []).reduce((sum, c) => sum + c.price * c.quantity, 0);
    reply = `🧾 Your Cart:\n${cartText}\nTotal = ₹${total}\n\nReply:\n1. ✅ Confirm\n2. ✏️ Edit\n3. ❌ Cancel`;
    await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(),null);
    return;
  }

  // Step 5: Cart Review
  if (session.stage === 'cart_review') {
    if (msg === '✅' || msg === '1' || msg === 'confirm') {
      delete sessions[userId]; // Clear session
      console.log('session', session);

    
      const transaction = await sequelize.transaction(); // Start a transaction
      try {
        // Save order in the database
        const mobileNumber = userId.startsWith('91') ? userId.slice(2) : userId;

        // Check if user exists in the database
        let user = await User.findOne({ where: { mobile: mobileNumber }, transaction });

        // If user does not exist, create a new user
        if (!user) {
          user = await User.create({
        mobile: mobileNumber,
        firstName: 'Guest', // Default values for new user
        lastName: 'User',
        email: null,
          }, { transaction });
        }

        // Create the order
        const order = await Order.create({
          userId: user.id,
          createdById: user.id,
          canteenId: session.selectedCanteen.id,
          menuConfigurationId: session.selectedMenu.id,
          totalAmount: (session.cart ?? []).reduce((sum, c) => sum + c.price * c.quantity, 0),
          status: 'initiated',
          orderDate: Math.floor(new Date().getTime() / 1000),
        }, { transaction });

        // Save order items in the database
        await Promise.all(
          (session.cart ?? []).map(async (item) => {
        await OrderItem.create({
          orderId: order.id,
          itemId: item.itemId,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          createdById: user.id,
        }, { transaction });
          })
        );

        // Store payment details in the Payment table
        const payment = await Payment.create({
          orderId: order.id,
          userId: user.id,
          createdById: user.id,
          amount: (session.cart ?? []).reduce((sum, c) => sum + c.price * c.quantity, 0),
          totalAmount: (session.cart ?? []).reduce((sum, c) => sum + c.price * c.quantity, 0),
          status: 'Pending',
          paymentMethod: "UPI",
          gatewayCharges: 0,
          gatewayPercentage: 0,
          currency: 'INR',
        }, { transaction });

        // Commit the transaction
        await transaction.commit();


        // Generate payment link using the PaymentLink function from utils
        const paymentLink = await PaymentLink(order, payment, user);
        console.log('Payment link generated:', paymentLink);

        // Send payment link to the user
        reply = `💳 Complete your payment using the following link:\n${paymentLink}`;
      //  reply = `✅ Order placed successfully with Order ID: ${order.id}. Thank you!`;
      } catch (error: any) {
        // Rollback the transaction in case of an error
        await transaction.rollback();
        console.error('Error placing order:', error.message);
        reply = '❌ Failed to place the order. Please try again later.';
      }
      await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(),null);
      return;
    }
    if (msg === '✏️' || msg === '2' || msg === 'edit') {
      session.stage = 'cart_selection';
      sessions[userId] = session;
      const itemList = session.items.map((i: { id: any; name: any; price: any }) => `${i.id}. ${i.name} - ₹${i.price}`).join('\n');
      reply = `✏️ Edit Items:\n${itemList}\n\nSend items like: 1*2,2*1`;
      await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(),null);
      return;
    }
    if (msg === '❌' || msg === '3' || msg === 'cancel') {
      delete sessions[userId]; // Clear session
      reply = '❌ Order cancelled. You can start again by typing hi.';
      await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(),null);
      return;
    }
  }

  // Default response for invalid input
  reply = '❓ Invalid input. Please type "hi" to restart.';
  await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(),null);
};


/**
 * Function to send a WhatsApp message via Airtel API
 */
export const sendWhatsAppMessage = async (
  to: string,
  reply: string,
  fromNumber: string,
  base64Image: string | null
) => {
  const username = 'world_tek';
  const password = 'T7W9&w3396Y"'; // Store in environment variables in production
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  const textUrl =
    'https://iqwhatsapp.airtel.in/gateway/airtel-xchange/basic/whatsapp-manager/v1/session/send/text';

  const uploadUrl =
    'https://iqwhatsapp.airtel.in/gateway/airtel-xchange/basic/whatsapp-manager/v1/session/upload/media';

  const mediaSendUrl =
    'https://iqwhatsapp.airtel.in/gateway/airtel-xchange/basic/whatsapp-manager/v1/session/send/media';

  try {
    // 🔹 If no image, send as text message
    if (!base64Image) {
      const textPayload = {
        sessionId: generateUuid(),
        to,
        from: fromNumber,
        message: {
          type: 'text',
          text: reply,
        },
      };

      const response = await axios.post(textUrl, textPayload, { headers });
      console.log('✅ Text message sent:', response.data);
      return response.data;
    }

    // 🔹 Clean base64 data (remove prefix if exists)
    const cleanedBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    // 🔹 Upload image to get mediaId
    const uploadPayload = {
      sessionId: generateUuid(),
      type: 'image',
      attachment: {
        base64: cleanedBase64,
        filename: 'qr-code.png',
      },
    };

    const uploadRes = await axios.post(uploadUrl, uploadPayload, { headers });
    const mediaId = uploadRes.data.mediaId;

    if (!mediaId) {
      throw new Error('❌ Media upload failed. mediaId not returned.');
    }

    // 🔹 Send image message using mediaId
    const mediaPayload = {
      sessionId: generateUuid(),
      to,
      from: fromNumber,
      message: {
        type: 'image',
        image: {
          id: mediaId,
          caption: reply,
        },
      },
    };

    const mediaRes = await axios.post(mediaSendUrl, mediaPayload, { headers });
    console.log('✅ Image message sent:', mediaRes.data);
    return mediaRes.data;

  } catch (error: any) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
};


/**
 * Upload an image to Airtel API
//  * @param filePath - The local file path of the image to upload
//  * @returns The media ID returned by the Airtel API
 */
// const uploadImageToAirtelAPI = async (filePath: string): Promise<string> => {
//   const url = 'https://iqwhatsapp.airtel.in:443/gateway/airtel-xchange/whatsapp-content-manager/v1/media';
//   const username = 'world_tek'; // Replace with your Airtel username
//   const password = 'T7W9&w3396Y"'; // Replace with your Airtel password

//   const auth = Buffer.from(`${username}:${password}`).toString('base64');

//   // Create FormData for the API request
//   const formData = new FormData();
//   formData.append('customerId', 'KWIKTSP_CO_j3og3FCEU1TsAz1EO7wQ'); // Replace with your customer ID
//   formData.append('phoneNumber', '918686078782'); // Replace with your Airtel-registered number
//   formData.append('mediaType', 'IMAGE');
//   formData.append('messageType', 'TEMPLATE_MESSAGE');
//   formData.append('file', fs.createReadStream(filePath)); // Attach the file

//   try {
//     const response = await axios.post(url, formData, {
//       headers: {
//         Authorization: `Basic ${auth}`,
//         ...formData.getHeaders(), // Dynamically set headers for FormData
//       },
//     });

//     console.log('✅ Image uploaded successfully:', response.data);

//     // Return the media ID from the response
//     if (response.data && response.data.id) {
//       // sendImageWithAttachment(response.data.id, '919490219062', '01jxc2n4fawcmzwpewsx7024wg', ['prasahnth',], ['payload1']);
//       return response.data.id;
//     } else {
//       throw new Error('❌ Media ID not returned by Airtel API.');
//     }
//   } catch (error: any) {
//     console.error('❌ Error uploading image to Airtel API:', error.response?.data || error.message);
//     throw error;
//   }
// };


// import fs from 'fs';
// import path from 'path';
// import FormData from 'form-data'; // Import FormData from the 'form-data' package

/**
//  * Upload a base64 image to a local directory
//  * @param base64Image - The base64 string of the image
//  * @param fileName - The name of the file to save (e.g., 'qr-code.png')
//  * @param directory - The directory where the file should be saved
//  * @returns The file path of the saved image
 */

/**
 * Upload a base64 image to Airtel API
//  * @param base64Image - The base64 string of the image
//  * @param fileName - The name of the file to upload (e.g., 'qr-code.png')
//  * @returns The media ID returned by the Airtel API
 */

export const sendImageWithoutAttachment = async (
  to: string,
  templateId: string,
  variables: string[],
  payload: string[]
): Promise<void> => {
  const url = 'https://iqwhatsapp.airtel.in/gateway/airtel-xchange/basic/whatsapp-manager/v1/template/send';
  const username = 'world_tek'; // Replace with your Airtel username
  const password = 'T7W9&w3396Y"'; // Replace with your Airtel password

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  // Payload for the API
  const payloadData = {
    templateId,
    to,
    from: '918686078782', // Replace with your Airtel-registerewebd number
    message: {
      headerVars: [],
      variables,
      payload,
    },
    
  };
  console.log('Sending message with out attachment:', payloadData);

  try {
    const response = await axios.post(url, payloadData, { headers });
    console.log('✅ Message sent successfully:', response.data);
  } catch (error: any) {
    console.error('❌ Error sending message with attachment:', error.response?.data || error.message);
    throw error;
  }
};

// import AWS from 'aws-sdk';



/**
 * Upload a base64 image to an S3 bucket
 * @param base64Image - The base64 string of the image
 * @param bucketName - The name of the S3 bucket
 * @param folderName - The folder name in the S3 bucket (optional)
 * @returns The URL of the uploaded image
 */
// const uploadBase64ImageToS3 = async (
//   base64Image: string,
//   bucketName: string,
//   folderName: string = ''
// ): Promise<string> => {
//   // Configure AWS SDK
//   AWS.config.update({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Replace with your AWS access key
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Replace with your AWS secret key
//     region: process.env.AWS_REGION || 'us-east-1', // Replace with your AWS region
//   });

//   const s3 = new AWS.S3();

//   // Clean the base64 string (remove the prefix if it exists)
//   const base64Data = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64');

//   // Determine the file type (e.g., png, jpeg)
//   const fileType = base64Image.match(/^data:image\/(\w+);base64,/)?.[1] || 'png';

//   // Generate a unique file name
//   const fileName = `${folderName ? `${folderName}/` : ''}${uuidv4()}.${fileType}`;

//   // S3 upload parameters
//   const params = {
//     Bucket: bucketName,
//     Key: fileName,
//     Body: base64Data,
//     ContentType: `image/${fileType}`,
//   };

//   try {
//     const result = await s3.upload(params).promise();


//     console.log('✅ Image uploaded successfully to S3:', result.Location);
//     return result.Location; // Return the URL of the uploaded image
//   } catch (error: any) {
//     console.error('❌ Error uploading image to S3:', error.message);
//     throw error;
//   }
// };
// Removed duplicate declaration of uploadImageToAirtelAPI
// export const uploadBase64Image = (base64Image: string, fileName: string, directory: string): string => {
//   try {
//     // Ensure the directory exists
//     if (!fs.existsSync(directory)) {
//       fs.mkdirSync(directory, { recursive: true });
//     }

//     // Clean the base64 string (remove the prefix if it exists)
//     const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

//     // Define the file path
//     const filePath = path.join(directory, fileName);
//     console.log("@@@@",filePath)
//     uploadImageToAirtelAPI(filePath)
//     // Write the file to the local directory
//     fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });

//     console.log(`✅ Image saved successfully at: ${filePath}`);
//     return filePath;
//   } catch (error:any) {
//     console.error('❌ Error saving image:', error.message);
//     throw error;
//   }
// };

// const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1PADUAAAAAklEQVR4AewaftIAAAS4SURBVO3BQY4kRxIEQbVA/f/Lun1bPwWQSK8mZ2gi8QdVSw5Viw5Viw5Viw5Viw5Viw5Viw5Viw5Viw5Viw5Viw5Viw5Viw5Viz68lITfpPJEEp5QuUnCjcqUhCdUpiT8JpU3DlWLDlWLDlWLPixT2ZSEN1Q2qbyhMiXhCZVNSdh0qFp0qFp0qFr04cuS8ITKE0mYVG6ScKMyJWFSmZIwqUwqUxI2JeEJlW86VC06VC06VC368B+jMiXhRuWJJEwqNyp/k0PVokPVokPVog9/mSRMKjcqUxKeUKn/O1QtOlQtOlQt+vBlKr9JZUrCpDIl4Y0kTCpTEiaVTSr/JoeqRYeqRYeqRR+WJeFPpjIlYVKZkvBGEiaVmyT8mx2qFh2qFh2qFh15Kwo3KpDIl4UblCZUnkjCpvKEyJeENlU2HqkWHqkWHqkXfXlKZknCThCdUpiRMSZhUblSmJEwqUxImlSkJk8qk8obKlIRJ5YkkTCqbDlWLDlWLDlWL4g/+QUl4Q+WJJEwqm5JwozIlYVJ5Iwk3Kt90qFp0qFp0qFr0YVkSnlB5IglPJGFSmZLwhsoTSZhUpiS8oTIl4SYJk8obh6pFh6pFh6pFH15Kwo3KTRImlSkJk8qUhEnlNyXhRuUJlSkJ36Sy6VC16FC16FC16MOXJeENlSkJk8obKlMSJpUpCZPKb1KZknCjMiVhUtl0qFp0qFp0qFr04ZepPJGETUmYVCaVKQmTypSEG5WbJEwqk8qNyk0SJpVvOlQtOlQtOlQtij94IQmTyk0SnlCZkvCGypSESeWNJDyhcpOETSpTEiaVNw5Viw5Viw5Viz58WRLeSMKNym9KwhMqN0m4UZmSMKlMSXhCZdOhatGhatGhatGHL1O5ScKNyk0SJpVNSZhUpiRMKjdJmFRukjCpTEmYVG6SMKlsOlQtOlQtOlQtij94IQmTypSESWVKwhsqN0mYVL4pCZPKTRI2qUxJeELljUPVokPVokPVoviDP1gSnlC5ScKNyhtJuFF5IgmbVN44VC06VC06VC368FISfpPKpDIl4ZuSMKlMSdiUhEnlDZVvOlQtOlQtOlQt+rBMZVMSbpIwqdwkYVK5UXlCZUrCpDIl4UblDZXfdKhadKhadKhad9OHLkvCEyqYk3CRhUpmS8IbKE0l4Q2VKwo3KpkPVokPVokPVog9/OZUpCZPKjcpNEiaVKQmTyo3KG0l4IgmTyhuHqkWHqkWHqkUf/uOS8E0qbyThCZWbJEwqm5Viw5Viw5Viz58mco3qUxJuFF5IwlPJOENlSkJk8qUhEnlNx2qFh2qFh2qFn1YloTflIQnkjCp3CThRmVKwqTyRBImlSdUpiRMKt90qFp0qFp0qFoUf1C15FC16FC16FC16FC16FC16FC16FC16FC16FC16FC16FC16FC16FC16FC16FC16H/E5DkSBtV3ygAAAABJRU5ErkJggg=='; // Example base64 string
// const fileName = 'example.png';
// const directory = './uploads';
// if (!process.env.AWS_S3_BUCKET_NAME) {
//   throw new Error('AWS_S3_BUCKET_NAME is not defined in the environment variables.');
// }
//uploadBase64ImageToS3(base64Image, process.env.AWS_S3_BUCKET_NAME, 'naval-dock-yard');
//uploadBase64Image(base64Image, fileName, directory);


/**
 * Generate a unique session ID
 */
function generateUuid(): string {
  return uuidv4();
}



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


