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

import { generateUniqueOrderNo } from './controllers/orderController'; // Import the function to generate unique order numbers
import fs from 'fs';
import path from 'path';
import FormData from 'form-data'; 




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

// ===================testing purpose===================

// ✅ Log how long each API takes to respond



app.use((req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const durationInMs = Number((seconds * 1000 + nanoseconds / 1e6).toFixed(2));

    if (durationInMs > 500) {
      // Format timestamp: YYYY-MM-DD HH:mm
      const now = new Date();
      const formattedTime = now.toLocaleString('sv-SE', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
      }).slice(0, 16); // e.g., 2025-08-07 08:49

      const logLine = `[${formattedTime}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${durationInMs} ms\n`;

      const logPath = path.join(__dirname, '../logs/slow-api.log');

      // Ensure the logs folder exists
      fs.mkdir(path.dirname(logPath), { recursive: true }, (err) => {
        if (err) {
          console.error('Error creating log folder:', err);
        } else {
          fs.appendFile(logPath, logLine, (err) => {
            if (err) console.error('Error writing to slow-api.log:', err);
          });
        }
      });

      // Also print to console (optional)
      console.warn(`[SLOW API > 500ms] ${logLine}`);
    }
  });

  next();
});


// ===================testing purpose===================



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

// GET endpoint to fetch payment method counts
// Self-invoked function to get payment method counts
(async () => {
  try {
    const results = await Payment.findAll({
      attributes: [
        'paymentMethod',
        [sequelize.fn('COUNT', sequelize.col('paymentMethod')), 'count']
      ],
      
      group: ['paymentMethod'],
      raw: true
    });


    
    // Format the results
    const paymentMethodCounts = results.map((result: any) => ({
      method: result.paymentMethod,
      count: parseInt(result.count)
    }));

    // You can do something with the results here
    return paymentMethodCounts;
  } catch (error) {
    console.error('Error fetching payment method counts:', error);
  }
})();


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
  canteens: any;
  cities?: string[];
  city?: string;
  service?: string;
  specializations?: string[]; // <-- Added this line
  specialization?: string;
  doctors?: any[];
  doctor?: any;
  doctorId?: any;
  clinics?: any[];
  clinic?: any;
  addressId?: any;
  dates?: string[];
  date?: string;
  slots?: string[];
  slot?: string;
  stage?: string;
  cart?: { itemId: number; name: string; price: number; quantity: number }[];
  selectedDate?: string;
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
    // console.log('Ignoring webhook request as msgStatus is not RECEIVED.');
    return res.status(200).json({ message: 'Webhook ignored.' });
  }

  // Check if recipientAddress matches the specific number
  if (req.body.recipientAddress === '918686078782') {
    // console.log('Navigating to another function for processing recipientAddress:', req.body.recipientAddress);
    await processSpecialRecipient(req.body); // Navigate to another function
    return res.status(200).json({ message: 'Special recipient processed.' });
  } else {
    await vydhyobot(req.body);
        return res.status(200).json({ message: 'Special recipient processed.' });

  }


});

const vydhyobot = async (body: any) => {
  const { sourceAddress: from, messageParameters } = body;
  if (!from || !messageParameters?.text?.body) return;

  const text = messageParameters.text.body.trim();
  // Initialize vydhyoSession if not present
  if (!sessions[from]) {
    sessions[from] = {
      items: [],
      selectedCanteen: null,
      canteens: [],
      menus: null,
      selectedMenu: null,
      cities: [],
      city: undefined,
      service: undefined,
      specializations: [],
      specialization: undefined,
      doctors: [],
      doctor: undefined,
      doctorId: undefined,
      clinics: [],
      clinic: undefined,
      addressId: undefined,
      dates: [],
      date: undefined,
      slots: [],
      slot: undefined,
      stage: undefined,
      cart: [],
      selectedDate: undefined
    };
  }
  const vydhyoSession = sessions[from];
  let reply = '';

  // 1. City selection
  if (!vydhyoSession.city) {
    if (text.toLowerCase() === 'hi') {
      vydhyoSession.city = undefined;
      vydhyoSession.service = undefined;
      vydhyoSession.specialization = undefined;
      vydhyoSession.doctor = undefined;
      vydhyoSession.date = undefined;
      vydhyoSession.slot = undefined;
      vydhyoSession.stage = 'city_selection';
      try {
        const { data } = await axios.get('https://server.vydhyo.com/whatsapp/cities');
        vydhyoSession.cities = Array.isArray(data?.data) ? data.data : [];
        if ((vydhyoSession.cities ?? []).length > 0) {
          reply = `👋 Welcome to Vydhyo! Please select your city:\n${(vydhyoSession.cities ?? []).map((city: string, i: number) => `${i + 1}) ${city}`).join('\n')}`;
        } else {
          reply = `❌ No cities found. Please try again later.`;
        }
      } catch {
        reply = `❌ No cities found. Please try again later.`;
      }
    } else if (vydhyoSession.cities && Number(text) >= 1 && Number(text) <= vydhyoSession.cities.length) {
      vydhyoSession.city = vydhyoSession.cities[Number(text) - 1];
      vydhyoSession.stage = 'specialization_selection';
      // Get specializations for city
      try {
        const { data } = await axios.get(`https://server.vydhyo.com/whatsapp/specializations`);
        vydhyoSession.specializations = Array.isArray(data?.data) ? data.data : [];
        if ((vydhyoSession.specializations ?? []).length > 0) {
          reply = `You selected ${vydhyoSession.city}. Please select a specialization:\n${(vydhyoSession.specializations ?? []).map((s: string, i: number) => `${i + 1}) ${s}`).join('\n')}`;
        } else {
          reply = `❌ No specializations found`;
        }
      } catch {
        reply = `❌ No specializations found. Please try again later.`;
      }
    } else {
      reply = `❓ I didn't understand that. Please type 'Hi' to start or select a valid city number.`;
    }
  }
  // 2. Specialization selection
  else if (!vydhyoSession.specialization) {
    if (vydhyoSession.specializations && Number(text) >= 1 && Number(text) <= vydhyoSession.specializations.length) {
      vydhyoSession.specialization = vydhyoSession.specializations[Number(text) - 1];
      vydhyoSession.stage = 'doctor_selection';
      // Get doctors for city & specialization
      try {
        const { data } = await axios.get(`https://server.vydhyo.com/whatsapp/doctors-by-specialization-city?city=${encodeURIComponent(vydhyoSession.city)}&specialization=${encodeURIComponent(vydhyoSession.specialization)}`);
        vydhyoSession.doctors = Array.isArray(data?.data) ? data.data : [];
        if ((vydhyoSession.doctors ?? []).length > 0) {
          reply = `You selected ${vydhyoSession.specialization}. Please select a doctor:\n${(vydhyoSession.doctors ?? []).map((d: any, i: number) => `${i + 1}) ${d.firstName} ${d.lastName}`).join('\n')}`;
        } else {
          reply = `❌ No doctors found for ${vydhyoSession.specialization} in ${vydhyoSession.city}.`;
        }
      } catch {
        reply = `❌ No doctors found. Please try again later.`;
      }
    } else {
      reply = `❓ I didn't understand that. Please select a valid specialization number:\n${vydhyoSession.specializations?.map((s: string, i: number) => `${i + 1}) ${s}`).join('\n')}`;
    }
  }
  // 3. Doctor selection
  else if (!vydhyoSession.doctor) {
    if (vydhyoSession.doctors && Number(text) >= 1 && Number(text) <= vydhyoSession.doctors.length) {
      vydhyoSession.doctor = vydhyoSession.doctors[Number(text) - 1];
      vydhyoSession.doctorId = vydhyoSession.doctor.id;
      // Get clinics for doctor & city
      try {
        const { data } = await axios.get(`https://server.vydhyo.com/whatsapp/clinics?doctorId=${vydhyoSession.doctorId}&city=${encodeURIComponent(vydhyoSession.city)}`);
        vydhyoSession.clinics = Array.isArray(data?.data) ? data.data : [];
        if ((vydhyoSession.clinics ?? []).length > 0) {
            reply = `You selected ${vydhyoSession.doctor.firstName} ${vydhyoSession.doctor.lastName}. Please select a clinic:\n${(vydhyoSession.clinics ?? []).map((c: any, i: number) => `${i + 1}) ${c.address}`).join('\n')}`;
          vydhyoSession.stage = 'clinic_selection';
        } else {
          reply = `❌ No clinics found for ${vydhyoSession.doctor.firstName} in ${vydhyoSession.city}.`;
        }
      } catch {
        reply = `❌ No clinics found. Please try again later.`;
      }
    } else {
      reply = `❓ I didn't understand that. Please select a valid doctor number:\n${vydhyoSession.doctors?.map((d: any, i: number) => `${i + 1}) ${d.name}`).join('\n')}`;
    }
  }
  // 4. Clinic selection
  else if (!vydhyoSession.clinic) {
    if (vydhyoSession.clinics && Number(text) >= 1 && Number(text) <= vydhyoSession.clinics.length) {
      vydhyoSession.clinic = vydhyoSession.clinics[Number(text) - 1];
      vydhyoSession.addressId = vydhyoSession.clinic.id;
      // Get next 3 available dates for doctorId, addressId
      try {
        const { data } = await axios.get(`https://server.vydhyo.com/whatsapp/available-dates?doctorId=${vydhyoSession.doctorId}&addressId=${vydhyoSession.addressId}`);
        vydhyoSession.dates = Array.isArray(data?.data) ? data.data.slice(0, 3) : [];
        if ((vydhyoSession.dates ?? []).length > 0) {
          reply = `You selected clinic: ${vydhyoSession.clinic.address}\nPlease select a date:\n${(vydhyoSession.dates ?? []).map((d: string, i: number) => `${i + 1}) ${d}`).join('\n')}`;
          vydhyoSession.stage = 'date_selection';
        } else {
          reply = `❌ No dates available for this clinic.`;
        }
      } catch {
        reply = `❌ No dates available. Please try again later.`;
      }
    } else {
      reply = `❓ I didn't understand that. Please select a valid clinic number:\n${vydhyoSession.clinics?.map((c: any, i: number) => `${i + 1}) ${c.address}`).join('\n')}`;
    }
  }
  // 5. Date selection
  else if (!vydhyoSession.date) {
    if (vydhyoSession.dates && Number(text) >= 1 && Number(text) <= vydhyoSession.dates.length) {
      vydhyoSession.date = vydhyoSession.dates[Number(text) - 1];
      // Get slots for doctorId, addressId, date
      try {
        const { data } = await axios.get(`https://server.vydhyo.com/whatsapp/slots?doctorId=${vydhyoSession.doctorId}&addressId=${vydhyoSession.addressId}&date=${encodeURIComponent(vydhyoSession.date)}`);
        vydhyoSession.slots = Array.isArray(data?.data) ? data.data : [];
        if ((vydhyoSession.slots ?? []).length > 0) {
          reply = `You selected ${vydhyoSession.date}. Please select a time slot:\n${(vydhyoSession.slots ?? []).map((s: string, i: number) => `${i + 1}) ${s}`).join('\n')}`;
          vydhyoSession.stage = 'slot_selection';
        } else {
          reply = `❌ No slots available for this date.`;
        }
      } catch {
        reply = `❌ No slots available. Please try again later.`;
      }
    } else {
      reply = `❓ I didn't understand that. Please select a valid date number:\n${vydhyoSession.dates?.map((d: string, i: number) => `${i + 1}) ${d}`).join('\n')}`;
    }
  }
  // 6. Slot selection
  else if (!vydhyoSession.slot) {
    if (vydhyoSession.slots && Number(text) >= 1 && Number(text) <= vydhyoSession.slots.length) {
      vydhyoSession.slot = vydhyoSession.slots[Number(text) - 1];
      reply = `You selected ${vydhyoSession.slot}. Confirm your appointment by replying 'Yes'.`;
      vydhyoSession.stage = 'confirm';
    } else {
      reply = `❓ I didn't understand that. Please select a valid slot number:\n${vydhyoSession.slots?.map((s: string, i: number) => `${i + 1}) ${s}`).join('\n')}`;
    }
  }
  // 7. Confirmation
  else if (vydhyoSession.stage === 'confirm' && text.toLowerCase() === 'yes') {
    // Confirm appointment (dummy API call)
    try {
      await axios.post('https://server.vydhyo.com/whatsapp/book', {
        city: vydhyoSession.city,
        specialization: vydhyoSession.specialization,
        doctorId: vydhyoSession.doctorId,
        addressId: vydhyoSession.addressId,
        date: vydhyoSession.date,
        slot: vydhyoSession.slot,
        user: from
      });
      reply = `✅ Appointment confirmed!\n\nDetails:\nCity: ${vydhyoSession.city}\nSpecialization: ${vydhyoSession.specialization}\nDoctor: ${vydhyoSession.doctor.name}\nClinic: ${vydhyoSession.clinic.address}\nDate: ${vydhyoSession.date}\nSlot: ${vydhyoSession.slot}`;
      delete sessions[from];
    } catch {
      reply = `❌ Failed to confirm appointment. Please try again later.`;
    }
  } else {
    reply = `❓ I didn't understand that. Please type 'Hi' to start again.`;
  }

  try {
    await sendWhatsAppMessage(from, reply, FROM_NUMBER.toString(), null);
  } catch (error: any) {
    console.error('❌ Error sending reply:', error.message);
  }
};
  // Your Vydhyobot implementation here

/**
 * Function to process special recipient
 */
const processSpecialRecipient = async (body: any) => {
  const { messageParameters, sourceAddress: userId } = body;

  if (!messageParameters?.text?.body || !userId) {
    // console.error('Invalid payload for special recipient:', body);
    return;
  }

  const msg = messageParameters.text.body.trim().toLowerCase();

  // Initialize session for the user if not already present
  if (!sessions[userId]) {
    sessions[userId] = { stage: 'menu_selection', items: [], cart: [], canteens: [], menus: null, selectedCanteen: null, selectedMenu: null, selectedDate: undefined };
  }

  const session = sessions[userId];
  let reply = '';
  const FROM_NUMBER = "918686078782";

  // Step 1: Menu Selection
  if (msg === 'hi') {
    session.stage = 'menu_selection';
     // ==========================temperory stop wtsp start =====================
  // Stopping the WhatsApp service temporarily
//   const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.wellfarecanteen';
//   let reply = `🚫 WhatsApp ordering is currently unavailable.\nPlease use our app to place your canteen orders.\n\n📲 Download the app here:\n${playStoreUrl}`;

//   // Save session if needed
//   sessions[userId] = session;

//   // Send the reply and return early
//   await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(), null);
  
// return
  // ==========================temperory stop wtsp end =====================
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
      reply = `🍽️ Welcome To welfare canteen naval dock yard! Choose a canteen:\n${list}`;
    } else {
      reply = `❌ No canteens available at the moment. Please try again later.`;
    }
    sessions[userId] = session;
    await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(), null);
    return;
  }

  // Step 1.5: Date Selection (Added Step)
  if (session.stage === 'menu_selection' && /^[1-9]\d*$/.test(msg)) {
    const index = parseInt(msg) - 1;
    if (index < 0 || index >= session.canteens.length) {
      reply = `⚠️ Invalid canteen option. Please select a valid canteen number from the list above or type "hi" to restart.`;
      await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(), null);
      return;
    }

    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);

    const todayFormatted = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    const tomorrowFormatted = `${String(tomorrow.getDate()).padStart(2, '0')}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${tomorrow.getFullYear()}`;

    reply = `📅 Please select a date:\n1. Today (${todayFormatted})\n2. Tomorrow (${tomorrowFormatted})`;
    session.stage = 'date_selection';
    session.selectedCanteen = session.canteens[index];
    sessions[userId] = session;
    await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(), null);
    return;
  }

  // Step 2: Canteen Selection (After Date Selection)
  if (session.stage === 'date_selection' && /^[1-2]$/.test(msg)) {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);

    const todayFormatted = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    const tomorrowFormatted = `${String(tomorrow.getDate()).padStart(2, '0')}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${tomorrow.getFullYear()}`;

    if (msg === '1') {
      session.selectedDate = todayFormatted;
    } else if (msg === '2') {
      session.selectedDate = tomorrowFormatted;
    } else {
      reply = '⚠️ Invalid date option. Please reply with 1 for Today or 2 for Tomorrow, or type "hi" to restart.';
      await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(), null);
      return;
    }

    session.stage = 'item_selection';
    const menus = await axios
      .get(`${process.env.BASE_URL}/api/menu/getMenusByCanteen?canteenId=${session.selectedCanteen.id}&date=${session.selectedDate}`)
      .then(response => response.data.data || [])
      .catch(error => {
      console.error('Error fetching menus:', error.message);
      return [];
      });

    if (menus.length > 0) {
      session.menus = menus;
      const menuList = menus.map((m: { name: any }, idx: number) => `${idx + 1}. ${m.name}`).join('\n');
      reply = `🍴 ${session.selectedCanteen.canteenName.toUpperCase()} MENU:\n${menuList}\n\nSend menu number to proceed.`;
    } else {
      reply = `❌ No menus available for ${session.selectedCanteen.canteenName}. Please try again or select another date by replying with 1 for Today or 2 for Tomorrow, or type "hi" to restart.`;
      session.stage = 'date_selection'; // Allow user to select another canteen
    }
    sessions[userId] = session;
    await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(), null);
    return;
  }

  // Step 3: Menu Selection

  // Step 3: Menu Selection
if (session.stage === 'item_selection' && /^[1-9]\d*$/.test(msg)) {
  const index = parseInt(msg) - 1;
  if (index < 0 || index >= session.menus.length) {
    reply = '⚠️ Invalid menu option. Please select a valid menu number from the list above or type "hi" to restart.';
    await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(), null);
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
  await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(), null);
  return;
}

if (session.stage === 'cart_selection' && /^\d+\*\d+(,\d+\*\d+)*$/.test(msg)) {
    const selections = msg.split(',');
    // Check if all selected item IDs exist in the session.items list
    const invalidSelections = selections.filter((pair: { split: (arg0: string) => [any]; }) => {
      const [idStr] = pair.split('*');
      const id = parseInt(idStr);
      return !session.items.some((i: { id: number }) => i.id === id);
    });

    if (invalidSelections.length > 0) {
      reply = `⚠️ Invalid item number(s): ${invalidSelections.map((pair: string) => pair.split('*')[0]).join(', ')}. Please select valid item numbers from the list above.`;
      await sendWhatsAppMessage(userId, reply, FROM_NUMBER.toString(), null);
      return;
    }
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
      reply = `❌ No menus available for ${session.selectedCanteen.canteenName}. Please try again later.`;
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
      // console.log('session', session);

    
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
            const orderNo = await generateUniqueOrderNo(user.id, transaction);

        const order = await Order.create({
          userId: user.id,
          createdById: user.id,
          orderNo: orderNo,
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
        // console.log('Payment link generated:', paymentLink);

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

  
  


      


  
  
  

  // Remaining steps (Menu Selection, Cart Selection, Cart Review, etc.) remain unchanged.
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
      // console.log('✅ Text message sent:', response.data);
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
    // console.log('✅ Image message sent:', mediaRes.data);
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
/**
 * Upload an image to Airtel API
 * @returns The media ID returned by the Airtel API
 */



export const uploadImageToAirtelAPI = async (filePath: string): Promise<string> => {
  const url = 'https://iqwhatsapp.airtel.in:443/gateway/airtel-xchange/whatsapp-content-manager/v1/media';
  const username = 'world_tek'; 
  const password = 'T7W9&w3396Y"'; 

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  // Create FormData for the API request
  const formData = new FormData();
  formData.append('customerId', 'KWIKTSP_CO_j3og3FCEU1TsAz1EO7wQ');
  formData.append('phoneNumber', '918686078782');
  formData.append('mediaType', 'IMAGE');
  formData.append('messageType', 'TEMPLATE_MESSAGE');
  
  try {
    // Construct path to file in upload folder
    const uploadDir = path.join(__dirname, '../uploads');
    
    // Check if directory exists, if not create it
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      // console.log(`Created directory: ${uploadDir}`);
    }
    
    const fullPath = filePath || path.join(uploadDir, 'default.png');
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      // console.log(`File not found: ${fullPath}`);
      
      // Use a default image instead - create a simple 1x1 pixel PNG
      const defaultImagePath = path.join(uploadDir, 'default.png');
      
      // Create a simple pixel image if it doesn't exist
      if (!fs.existsSync(defaultImagePath)) {
        // This is a minimal valid PNG file (1x1 transparent pixel)
        const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        fs.writeFileSync(defaultImagePath, minimalPng);
        // console.log(`Created default image: ${defaultImagePath}`);
      }
      
      formData.append('file', fs.createReadStream(defaultImagePath));
      // console.log(`Using default image instead: ${defaultImagePath}`);
    } else {
      formData.append('file', fs.createReadStream(fullPath));
      // console.log(`Using original image: ${fullPath}`);
    }

    // console.log('Uploading image to Airtel API...');  

    const response = await axios.post(url, formData, {
      headers: {
        Authorization: `Basic ${auth}`,
        ...formData.getHeaders(),
      },
    });


    // Return the media ID from the response
    if (response.data && response.data.id) {
      // If upload was successful, remove the file to avoid cluttering
      // Only delete if it's not the default image
      if (fullPath !== path.join(uploadDir, 'default.png')) {
        try {
          fs.unlinkSync(fullPath);
        } catch (deleteError) {
          // Continue execution even if file deletion fails
        }
      }
      return response.data.id;
    } else {
      throw new Error('❌ Media ID not returned by Airtel API.');
    }
  } catch (error: any) {
    console.error('❌ Error uploading image to Airtel API:', error.response?.data || error.message);
    throw error;
  }
};
// ();

// Import FormData from the 'form-data' package

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
  payload: string[],whatsappuploadedid: string | null = null
): Promise<void> => {
  const url = 'https://iqwhatsapp.airtel.in/gateway/airtel-xchange/basic/whatsapp-manager/v1/template/send';
  const username = 'world_tek'; // Replace with your Airtel username
  const password = 'T7W9&w3396Y"'; // Replace with your Airtel password

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };
  // console.log("to number",to)
  // Payload for the API
  const payloadData = {
    templateId,
    to,
    from: '918686078782', // Replace with your Airtel-registered number
    message: {
      headerVars: [],
      variables,
      payload,
    },
    ...(whatsappuploadedid && {
      mediaAttachment: {
        type: "IMAGE",
        id: whatsappuploadedid
      }
    })
  };

  try {
    const response = await axios.post(url, payloadData, { headers });
    console.log('✅ Message with attachment sent:', response.data);
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

// const base64Image = 'data:image/png;base64,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


/**
 * Generate a unique session ID
 */
function generateUuid(): string {
  return uuidv4();
}



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


