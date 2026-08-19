require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const seedUsers = [
  {
    name: 'Super Admin',
    email: 'super_admin@jslabels.com',
    phone: '9999999991',
    role: 'super_admin',
    status: 'active'
  },
  {
    name: 'Manager User',
    email: 'manager@jslabels.com',
    phone: '9999999992',
    role: 'manager',
    status: 'active'
  },
  {
    name: 'Caller User',
    email: 'caller@jslabels.com',
    phone: '9999999993',
    role: 'caller',
    status: 'active'
  }
];

const seed = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('Error: MONGO_URI is missing in .env file');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Test1234!', salt);

    for (const userData of seedUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        await User.create({
          ...userData,
          passwordHash
        });
        console.log(`Created user: ${userData.email} (${userData.role})`);
      } else {
        console.log(`User already exists: ${userData.email}`);
      }
    }

    console.log('Database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seed();
