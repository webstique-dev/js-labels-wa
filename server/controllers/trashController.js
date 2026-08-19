const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const FollowUp = require('../models/FollowUp');
const Activity = require('../models/Activity');

const MODEL_MAP = {
  leads: Lead,
  customers: Customer,
  orders: Order,
  products: Product,
  users: User,
  followups: FollowUp
};

// GET /api/:resource/trash (or /api/trash/:resource)
const getTrash = async (req, res) => {
  try {
    const resource = (req.params.resource || '').toLowerCase();
    const Model = MODEL_MAP[resource];

    if (!Model) {
      return res.status(400).json({ message: `Invalid resource type: ${resource}` });
    }

    let query = Model.find({ isDeleted: true }).setOptions({ includeDeleted: true }).sort({ deletedAt: -1 }).populate('deletedBy', 'name email avatarUrl role');

    // Population for context per model
    if (resource === 'orders') {
      query = query.populate('customerId', 'name company phone email city');
    } else if (resource === 'leads' || resource === 'followups') {
      query = query.populate('assignedTo', 'name email avatarUrl role');
    } else if (resource === 'customers') {
      query = query.populate('salesExecutive', 'name email avatarUrl role');
    }

    const items = await query;
    return res.json(items);
  } catch (error) {
    console.error('Error fetching trash records:', error);
    return res.status(500).json({ message: 'Server error fetching trash records' });
  }
};

// POST /api/:resource/:id/restore (or /api/trash/:resource/:id/restore)
const restoreRecord = async (req, res) => {
  try {
    const resource = (req.params.resource || '').toLowerCase();
    const { id } = req.params;
    const Model = MODEL_MAP[resource];

    if (!Model) {
      return res.status(400).json({ message: `Invalid resource type: ${resource}` });
    }

    const item = await Model.findOne({ _id: id, isDeleted: true }).setOptions({ includeDeleted: true });

    if (!item) {
      return res.status(404).json({ message: `${resource.slice(0, -1)} not found in trash` });
    }

    await item.restore();

    // Log activity if relevant
    let activityRelatedType = null;
    let activityRelatedId = item._id;

    if (resource === 'leads') activityRelatedType = 'lead';
    else if (resource === 'customers') activityRelatedType = 'customer';
    else if (resource === 'orders') {
      activityRelatedType = 'customer';
      activityRelatedId = item.customerId;
    }

    if (activityRelatedType && activityRelatedId) {
      await Activity.create({
        relatedType: activityRelatedType,
        relatedId: activityRelatedId,
        type: 'status_change',
        description: `Restored ${resource.slice(0, -1)}: ${item.name || item.orderNo || item._id}`,
        createdBy: req.user.id
      });
    }

    return res.json({ message: 'Record restored successfully', item });
  } catch (error) {
    console.error('Error restoring record:', error);
    return res.status(500).json({ message: 'Server error restoring record' });
  }
};

module.exports = {
  getTrash,
  restoreRecord
};
