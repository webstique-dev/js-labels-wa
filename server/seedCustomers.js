require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Activity = require('./models/Activity');

const seedCustomers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for customer seeding...');

    const caller = await User.findOne({ role: 'caller' });
    const manager = await User.findOne({ role: 'manager' });

    if (!caller || !manager) {
      console.error('Users not found. Please run npm run seed first.');
      process.exit(1);
    }

    // Clear existing customers & orders
    await Customer.deleteMany({});
    await Order.deleteMany({});
    await Activity.deleteMany({ relatedType: 'customer' });

    console.log('Cleared existing customers & orders.');

    // 1. Apex Logistics India Pvt Ltd (Caller user)
    const cust1 = await Customer.create({
      name: 'Apex Logistics India Pvt Ltd',
      company: 'Apex Logistics',
      phone: '+91 98765 43210',
      email: 'procurement@apexlogistics.in',
      gstNo: '27AAACA12341Z9',
      address: 'Plot 42, MIDC Industrial Area, Andheri East',
      city: 'Mumbai',
      customerType: 'Enterprise',
      paymentTerms: 'Net 30',
      creditLimit: 250000,
      currentBalance: 45000,
      tags: ['High Value Customer', 'VIP', 'Regular Buyer'],
      salesExecutive: caller._id,
      reorderProbability: 85,
      expectedReorderDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    });

    // 2. Metro Pharma Laboratories (Caller user)
    const cust2 = await Customer.create({
      name: 'Metro Pharma Laboratories',
      company: 'Metro Pharma Ltd',
      phone: '+91 91234 56789',
      email: 'orders@metropharma.com',
      gstNo: '07BBBPM56782Z1',
      address: 'Industrial Plot 18, Okhla Phase 3',
      city: 'New Delhi',
      customerType: 'Corporate',
      paymentTerms: 'Net 15',
      creditLimit: 150000,
      currentBalance: 12000,
      tags: ['Pharma Labeling', 'High Frequency'],
      salesExecutive: caller._id,
      reorderProbability: 65,
      expectedReorderDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000) // 12 days from now
    });

    // 3. Zenith Consumer Electronics (Manager user)
    const cust3 = await Customer.create({
      name: 'Zenith Consumer Electronics',
      company: 'Zenith Tech Ltd',
      phone: '+91 99887 76655',
      email: 'purchase@zenithtech.in',
      gstNo: '29CCCCZ90123Z4',
      address: 'Electronic City Phase 1, Hosur Road',
      city: 'Bengaluru',
      customerType: 'Enterprise',
      paymentTerms: 'Advance',
      creditLimit: 500000,
      currentBalance: 0,
      tags: ['Electronics', 'Barcode Labels'],
      salesExecutive: manager._id,
      reorderProbability: 40,
      expectedReorderDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000) // 25 days from now
    });

    console.log('Seeded 3 Customers.');

    // Seed Orders for Customer 1 (Apex Logistics)
    await Order.create({
      orderNo: 'ORD-2026-001',
      customerId: cust1._id,
      orderDate: new Date('2026-06-10'),
      amount: 68500,
      status: 'delivered',
      deliveryDate: new Date('2026-06-15'),
      salesExecutive: caller._id,
      usageCycleDays: 30,
      lineItems: [
        { name: 'Thermal Barcode Labels 50x25mm', qty: 50000, price: 0.85 },
        { name: 'Wax Ribbon Roll 110mm x 300m', qty: 20, price: 1300 }
      ]
    });

    await Order.create({
      orderNo: 'ORD-2026-002',
      customerId: cust1._id,
      orderDate: new Date('2026-07-12'),
      amount: 74000,
      status: 'delivered',
      deliveryDate: new Date('2026-07-16'),
      salesExecutive: caller._id,
      usageCycleDays: 30,
      lineItems: [
        { name: 'Thermal Barcode Labels 50x25mm', qty: 60000, price: 0.85 },
        { name: 'Resin Ribbon Roll 110mm x 300m', qty: 15, price: 1500 }
      ]
    });

    await Order.create({
      orderNo: 'ORD-2026-003',
      customerId: cust1._id,
      orderDate: new Date('2026-08-14'),
      amount: 82000,
      status: 'dispatched',
      deliveryDate: new Date('2026-08-20'),
      salesExecutive: caller._id,
      usageCycleDays: 30,
      lineItems: [
        { name: 'Thermal Barcode Labels 50x25mm', qty: 70000, price: 0.85 },
        { name: 'Custom Shipping Box Labels', qty: 15000, price: 1.50 }
      ]
    });

    // Seed Orders for Customer 2 (Metro Pharma)
    await Order.create({
      orderNo: 'ORD-2026-004',
      customerId: cust2._id,
      orderDate: new Date('2026-07-01'),
      amount: 32000,
      status: 'delivered',
      deliveryDate: new Date('2026-07-05'),
      salesExecutive: caller._id,
      usageCycleDays: 45,
      lineItems: [
        { name: 'Pharma Vials Self-Adhesive Labels', qty: 25000, price: 1.10 },
        { name: 'Tamper Evident Security Seals', qty: 5000, price: 0.90 }
      ]
    });

    await Order.create({
      orderNo: 'ORD-2026-005',
      customerId: cust2._id,
      orderDate: new Date('2026-08-05'),
      amount: 35500,
      status: 'production',
      deliveryDate: new Date('2026-08-25'),
      salesExecutive: caller._id,
      usageCycleDays: 45,
      lineItems: [
        { name: 'Pharma Vials Self-Adhesive Labels', qty: 30000, price: 1.10 },
        { name: 'Tamper Evident Security Seals', qty: 2700, price: 0.90 }
      ]
    });

    // Seed Orders for Customer 3 (Zenith Electronics)
    await Order.create({
      orderNo: 'ORD-2026-006',
      customerId: cust3._id,
      orderDate: new Date('2026-05-20'),
      amount: 125000,
      status: 'delivered',
      deliveryDate: new Date('2026-05-28'),
      salesExecutive: manager._id,
      usageCycleDays: 90,
      lineItems: [
        { name: 'High Temperature PCB Polyester Labels', qty: 40000, price: 2.50 },
        { name: 'Silver Matte Asset Tags', qty: 10000, price: 2.50 }
      ]
    });

    console.log('Seeded 6 Orders with line items.');

    // Seed initial Activity entries for Customer 1
    await Activity.create({
      relatedType: 'customer',
      relatedId: cust1._id,
      type: 'status_change',
      description: 'Converted lead to active Customer account',
      createdBy: caller._id
    });

    await Activity.create({
      relatedType: 'customer',
      relatedId: cust1._id,
      type: 'note',
      description: 'Client confirmed quarterly label requirements of 70k units.',
      createdBy: caller._id
    });

    console.log('Seeded Customer Activities.');
    console.log('Customer seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding customers:', error);
    process.exit(1);
  }
};

seedCustomers();
