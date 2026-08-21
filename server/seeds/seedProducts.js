const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');

const seedProducts = async () => {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.RENDER;
  if (isProd && process.env.ALLOW_SEED !== 'true') {
    console.warn('[SEED BLOCKED] Product seeding is disabled in production environments unless ALLOW_SEED=true');
    process.exit(0);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for product seeding...');

    await Product.deleteMany({});
    console.log('Cleared existing products.');

    const products = await Product.create([
      {
        name: 'Premium BOPP Labels',
        category: 'BOPP Film',
        unitPrice: 1.25,
        defaultUsageCycleDays: 30
      },
      {
        name: 'Barcode Labels 50x25mm',
        category: 'Thermal Paper',
        unitPrice: 0.85,
        defaultUsageCycleDays: 30
      },
      {
        name: 'Transparent Poly Labels',
        category: 'Clear Film',
        unitPrice: 1.80,
        defaultUsageCycleDays: 45
      },
      {
        name: 'Matt Finish Paper Labels',
        category: 'Paper',
        unitPrice: 0.95,
        defaultUsageCycleDays: 30
      },
      {
        name: 'Glossy Product Labels',
        category: 'Paper',
        unitPrice: 1.10,
        defaultUsageCycleDays: 30
      },
      {
        name: 'Tamper Evident Security Seals',
        category: 'Security Film',
        unitPrice: 1.50,
        defaultUsageCycleDays: 45
      }
    ]);

    console.log(`Seeded ${products.length} label products successfully.`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedProducts();
}
