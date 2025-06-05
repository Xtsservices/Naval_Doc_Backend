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





//  const AIRTEL_API_URL = process.env.AIRTEL_API_URL!;
// const AIRTEL_TOKEN = process.env.AIRTEL_TOKEN!;
// const FROM_NUMBER = process.env.FROM_NUMBER!; // Airtel-registered number

const AIRTEL_API_URL = "https://iqwhatsapp.airtel.in/gateway/airtel-xchange/basic/whatsapp-manager/v1/session/send/text"

const FROM_NUMBER = 917337068888
const AIRTEL_TOKEN = 'T7W9&w3396Y"';

interface UserSession {
  items: string[];
  confirmed: boolean;
}


// 🔄 Webhook to receive incoming messages from Airtel
const sessions: Record<string, { city?: string; service?: string; specialization?: string; doctor?: string; date?: string; slot?: string }> = {};

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
    sessions[from] = {};
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
    await sendWhatsAppMessage(from, reply, FROM_NUMBER.toString());
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
  const { messageParameters, sourceAddress: from } = body;

  if (!messageParameters?.text?.body || !from) {
    console.error('Invalid payload for special recipient:', body);
    return;
  }

  const text = messageParameters.text.body.trim().toLowerCase();

  // Initialize session for the user if not already present
  if (!sessions[from]) {
    sessions[from] = {};
  }

  const session: any = sessions[from];
  let reply = '';

  console.log("session",session);

  // Step 1: Send list of canteens on "hi"
  if (!session.canteen) {
    if (text === 'hi') {
      const CANTEENS = await axios
        .get(`${process.env.BASE_URL}/api/canteen/getAllCanteensforwhatsapp`)
        .then(response => {
          if (response.data.data && Array.isArray(response.data.data)) {
            return response.data.data.map((canteen: { id: number; canteenName: string }) => ({
              id: canteen.id,
              name: canteen.canteenName,
            }));
          }
          return [];
        })
        .catch(error => {
          console.error('Error fetching canteen list:', error.message);
          return [];
        });

      if (CANTEENS.length > 0) {
        session.canteens = CANTEENS; // Store canteens in the session
        reply = `👋 Welcome! Here is the list of available canteens:\n${CANTEENS.map((canteen: { name: string }, index: number) => `${index + 1}) ${canteen.name}`).join('\n')}`;
      } else {
        reply = `❌ No canteens available at the moment. Please try again later.`;
      }
    } else {
      reply = `❓ I didn't understand that. Please type 'Hi' to get the list of canteens.`;
    }
  }
  // Step 2: Handle canteen selection
  else if (!session.selectedCanteen) {
    const selectedIndex = Number(text) - 1;
    if (session.canteens && selectedIndex >= 0 && selectedIndex < session.canteens.length) {
      const selectedCanteen = session.canteens[selectedIndex];
      session.selectedCanteen = selectedCanteen;

      // Fetch menus for the selected canteen
      const MENUS = await axios
        .get(`${process.env.BASE_URL}/api/menu/getMenusByCanteen?canteenId=${selectedCanteen.id}`)
        .then(response => {
          if (response.data.data && Array.isArray(response.data.data)) {
            return response.data.data.map((menu: { id: number; name: string }) => ({
              id: menu.id,
              name: menu.name,
            }));
          }
          return [];
        })
        .catch(error => {
          console.error('Error fetching menu list:', error.message);
          return [];
        });

      if (MENUS.length > 0) {
        session.menus = MENUS; // Store menus in the session
        reply = `You selected ${selectedCanteen.name}. Here are the available menus:\n${MENUS.map((menu: { name: string }, index: number) => `${index + 1}) ${menu.name}`).join('\n')}`;
      } else {
        reply = `❌ No menus available for ${selectedCanteen.name}. Please try again later.`;
      }
    } else {
      reply = `❓ Invalid selection. Please select a valid canteen number:\n${session.canteens.map((canteen: { name: string }, index: number) => `${index + 1}) ${canteen.name}`).join('\n')}`;
    }
  }
  // Step 3: Handle menu selection (optional for further implementation)
  else {
    reply = `❓ I didn't understand that. Please select a valid menu number or restart by typing 'Hi'.`;
  }

  // Send reply via Airtel API
  try {
    await sendWhatsAppMessage(from, reply, "918686078782");
    // console.log(`📤 Reply sent to ${from}: ${reply}`);
  } catch (error: any) {
    console.error('❌ Error sending reply:', error.message);
  }
};

/**
 * Function to send a WhatsApp message via Airtel API
 */
const sendWhatsAppMessage = async (to: string, reply: string, fromNumber: string) => {
  const url = 'https://iqwhatsapp.airtel.in/gateway/airtel-xchange/basic/whatsapp-manager/v1/session/send/text';
  const username = 'world_tek';
  const password = 'T7W9&w3396Y"'; // Replace with actual password

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const payload = {
    sessionId: generateUuid(),
    to, // Recipient number
    from: fromNumber, // Dynamically set the sender number
    message: {
      text: reply,
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    // console.log('Message sent successfully:', response.data);
  } catch (error: any) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Generate a unique session ID
 */
function generateUuid(): string {
  return uuidv4();
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
