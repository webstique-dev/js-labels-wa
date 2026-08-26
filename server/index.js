const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const leadRoutes = require('./routes/leadRoutes');
const activityRoutes = require('./routes/activityRoutes');
const followUpRoutes = require('./routes/followUpRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const devRoutes = require('./routes/devRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const trashRoutes = require('./routes/trashRoutes');
const searchRoutes = require('./routes/searchRoutes');
const productionRoutes = require('./routes/productionRoutes');

const { initReorderReminderJob } = require('./jobs/reorderReminderJob');

const app = express();

// Connect to MongoDB
connectDB().then(() => {
  const Lead = require('./models/Lead');
  Lead.updateMany({ status: 'rejected' }, { status: 'cancelled' })
    .then(res => {
      if (res.modifiedCount > 0) {
        console.log(`[DB Migration] Migrated ${res.modifiedCount} legacy 'rejected' leads to 'cancelled' (Order-Lost)`);
      }
    })
    .catch(err => console.warn('Non-fatal lead status migration check:', err.message));
});

// Initialize Cron Jobs
initReorderReminderJob();

// CORS configuration for production & local development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: "ok" });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/production', productionRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
