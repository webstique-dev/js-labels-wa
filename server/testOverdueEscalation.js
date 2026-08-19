require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const FollowUp = require('./models/FollowUp');
const Customer = require('./models/Customer');
const { runReorderReminderCheck } = require('./jobs/reorderReminderJob');
const { runEscalationCheck } = require('./jobs/escalationJob');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB...');

    // 1. Set a Customer expectedReorderDate to today (0 milestone)
    const customer = await Customer.findOne();
    if (customer) {
      const today = new Date();
      customer.expectedReorderDate = today;
      await customer.save();
      console.log(`Updated customer ${customer.name} expectedReorderDate to today.`);
    }

    // 2. Create an overdue FollowUp (80 hours overdue -> md_review)
    const eightyHoursAgo = new Date(Date.now() - 80 * 60 * 60 * 1000);
    const testFollowUp = await FollowUp.create({
      relatedType: 'customer',
      relatedId: customer._id,
      dueDate: eightyHoursAgo,
      notes: 'Test Overdue FollowUp for Escalation Engine Verification',
      status: 'open'
    });
    console.log(`Created overdue FollowUp ${testFollowUp._id} (80h overdue).`);

    console.log('\n--- EXECUTING REORDER REMINDER CHECK ---');
    await runReorderReminderCheck();

    console.log('\n--- EXECUTING ESCALATION CHECK ---');
    await runEscalationCheck();

    process.exit(0);
  } catch (err) {
    console.error('Error running test:', err);
    process.exit(1);
  }
};

runTest();
