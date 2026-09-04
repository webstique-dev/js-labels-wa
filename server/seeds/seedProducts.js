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
    if (!process.env.MONGO_URI) {
      console.error('Error: MONGO_URI is missing in .env file');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for product seeding...');

    await Product.deleteMany({});
    console.log('Cleared existing products.');

    const initialProducts = [
      {
        name: '4x45 Standard Label',
        widthMm: 4,
        heightMm: 45,
        category: 'BOPP',
        defaultUsageCycleDays: 30,
        unitPrice: 0.85,
        status: 'active'
      },
      {
        name: '4x45 Matte Finish Label',
        widthMm: 4,
        heightMm: 45,
        category: 'Matte BOPP',
        defaultUsageCycleDays: 30,
        unitPrice: 0.95,
        status: 'active'
      },
      {
        name: '10x15 Barcode Label',
        widthMm: 10,
        heightMm: 15,
        category: 'Barcode',
        defaultUsageCycleDays: 30,
        unitPrice: 0.70,
        status: 'active'
      },
      {
        name: '30x20 Carton Label',
        widthMm: 30,
        heightMm: 20,
        category: 'Thermal Paper',
        defaultUsageCycleDays: 45,
        unitPrice: 1.25,
        status: 'active'
      },
      {
        name: '20x25 Transparent Label',
        widthMm: 20,
        heightMm: 25,
        category: 'Transparent',
        defaultUsageCycleDays: 45,
        unitPrice: 1.40,
        status: 'active'
      },
      {
        name: '25x25 Round Label',
        widthMm: 25,
        heightMm: 25,
        category: 'Chromo Paper',
        defaultUsageCycleDays: 30,
        unitPrice: 1.10,
        status: 'active'
      },
      {
        name: '50x25 Shipping Barcode Label',
        widthMm: 50,
        heightMm: 25,
        category: 'Barcode',
        defaultUsageCycleDays: 30,
        unitPrice: 0.90,
        status: 'active'
      },
      {
        name: '100x150 Logistics Pallet Label',
        widthMm: 100,
        heightMm: 150,
        category: 'Thermal Paper',
        defaultUsageCycleDays: 45,
        unitPrice: 2.80,
        status: 'active'
      },
      {
        name: '15x15 Tamper Evident Void Seal',
        widthMm: 15,
        heightMm: 15,
        category: 'Security Film',
        defaultUsageCycleDays: 45,
        unitPrice: 3.50,
        status: 'active'
      }
    ];

    // Create products using .create or new Product().save() to trigger pre-save hooks
    const createdProducts = [];
    for (const p of initialProducts) {
      const doc = new Product(p);
      await doc.save();
      createdProducts.push(doc);
    }

    console.log(`Successfully seeded ${createdProducts.length} dimension-based products:`);
    createdProducts.forEach(p => {
      console.log(` - ${p.name} [Dim: ${p.dimensionKey}] (Cycle: ${p.defaultUsageCycleDays}d, Price: ${p.unitPrice ?? 'Not set'})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedProducts();
}
