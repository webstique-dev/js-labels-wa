require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Lead = require('./models/Lead');
const Activity = require('./models/Activity');

const seedLeads = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is missing');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for lead seeding...');

    const superAdmin = await User.findOne({ email: 'super_admin@jslabels.com' });
    const manager = await User.findOne({ email: 'manager@jslabels.com' });
    const caller = await User.findOne({ email: 'caller@jslabels.com' });

    if (!superAdmin || !manager || !caller) {
      console.error('Run seed.js first to create users!');
      process.exit(1);
    }

    // Clear existing leads and activities for clean seed
    await Lead.deleteMany({});
    await Activity.deleteMany({ relatedType: 'lead' });

    const leadsData = [
      {
        name: 'Rajesh Sharma',
        company: 'Apex Packaging Pvt Ltd',
        phone: '+91 9876543210',
        email: 'rajesh@apexpack.com',
        source: 'website',
        priority: 'high',
        status: 'new',
        assignedTo: caller._id,
        createdBy: manager._id
      },
      {
        name: 'Anita Verma',
        company: 'Cosmo Care Organics',
        phone: '+91 9812345678',
        email: 'anita@cosmocare.in',
        source: 'google_ads',
        priority: 'medium',
        status: 'new',
        assignedTo: caller._id,
        createdBy: superAdmin._id
      },
      {
        name: 'Vikram Mehta',
        company: 'Starlight Pharma',
        phone: '+91 9988776655',
        email: 'v.mehta@starlightpharma.com',
        source: 'referral',
        priority: 'high',
        status: 'contacted',
        assignedTo: caller._id,
        createdBy: manager._id
      },
      {
        name: 'Siddharth Rao',
        company: 'GreenField Foods',
        phone: '+91 9765432109',
        email: 'siddharth@greenfield.com',
        source: 'tele_caller',
        priority: 'low',
        status: 'contacted',
        assignedTo: manager._id,
        createdBy: superAdmin._id
      },
      {
        name: 'Pooja Kapoor',
        company: 'Velvet Apparel Co',
        phone: '+91 9654321098',
        email: 'pooja@velvetapparel.com',
        source: 'walk_in',
        priority: 'medium',
        status: 'follow_up',
        assignedTo: caller._id,
        createdBy: manager._id
      },
      {
        name: 'Manish Patel',
        company: 'Patel Bottling & Labeling',
        phone: '+91 9543210987',
        email: 'manish@patelbottling.com',
        source: 'website',
        priority: 'high',
        status: 'follow_up',
        assignedTo: caller._id,
        createdBy: superAdmin._id
      },
      {
        name: 'Deepak Joshi',
        company: 'Joshi Agro Products',
        phone: '+91 9432109876',
        email: 'deepak@joshiagro.in',
        source: 'referral',
        priority: 'high',
        status: 'won',
        assignedTo: caller._id,
        createdBy: manager._id
      },
      {
        name: 'Sunita Aggarwal',
        company: 'Sunlight Consumer Goods',
        phone: '+91 9321098765',
        email: 'sunita@sunlightcg.com',
        source: 'google_ads',
        priority: 'low',
        status: 'cancelled',
        assignedTo: caller._id,
        createdBy: manager._id,
        cancelReason: 'Client budget constraints'
      }
    ];

    for (const data of leadsData) {
      const lead = await Lead.create(data);
      await Activity.create({
        relatedType: 'lead',
        relatedId: lead._id,
        type: 'status_change',
        description: `Lead created (${lead.status})`,
        createdBy: data.createdBy
      });
    }

    console.log(`Successfully seeded ${leadsData.length} sample leads!`);
    process.exit(0);
  } catch (error) {
    console.error('Lead seeding error:', error);
    process.exit(1);
  }
};

seedLeads();
