const FollowUp = require('../models/FollowUp');
const Activity = require('../models/Activity');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');

// GET /api/followups
const getFollowUps = async (req, res) => {
  try {
    const { relatedType, relatedId, status, assignedTo } = req.query;

    // Single item query for detail page
    if (relatedType && relatedId) {
      const followUp = await FollowUp.findOne({ relatedType, relatedId, status: 'open' })
        .populate('assignedTo', 'name email phone avatarUrl role')
        .sort({ dueDate: 1 });
      return res.json(followUp || null);
    }

    // List query for /followups page
    let queryFilter = { ...req.scopeFilter };

    if (assignedTo && req.user.role !== 'caller') {
      queryFilter.assignedTo = assignedTo;
    }

    const rawFollowUps = await FollowUp.find(queryFilter)
      .populate('assignedTo', 'name email phone avatarUrl role')
      .sort({ dueDate: 1 });

    const now = new Date();

    // Populate related record (Lead or Customer) manually if ref path dynamic
    let populatedItems = await Promise.all(
      rawFollowUps.map(async (f) => {
        const itemObj = f.toObject();
        let relatedObj = null;

        if (f.relatedType === 'lead') {
          relatedObj = await Lead.findById(f.relatedId).select('name company phone email status');
        } else if (f.relatedType === 'customer') {
          relatedObj = await Customer.findById(f.relatedId).select('name company phone email city');
        }

        itemObj.relatedRecord = relatedObj;

        // Compute on-the-fly overdue status
        const dueDate = new Date(f.dueDate);
        let computedStatus = f.status;
        if (f.status === 'open' && dueDate < now) {
          computedStatus = 'overdue';
        }

        itemObj.status = computedStatus;
        itemObj.isOverdue = f.status === 'open' && dueDate < now;

        return itemObj;
      })
    );

    // Filter by status if requested
    if (status) {
      populatedItems = populatedItems.filter((i) => i.status === status.toLowerCase());
    }

    return res.json(populatedItems);
  } catch (error) {
    console.error('Error fetching followUps list:', error);
    return res.status(500).json({ message: 'Server error fetching followUps' });
  }
};

// GET /api/followups/summary
const getFollowUpSummary = async (req, res) => {
  try {
    const queryFilter = { ...req.scopeFilter };
    const rawFollowUps = await FollowUp.find(queryFilter);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const summary = {
      total: rawFollowUps.length,
      open: 0,
      dueToday: 0,
      overdue: 0,
      completed: 0
    };

    rawFollowUps.forEach((f) => {
      const dueDate = new Date(f.dueDate);

      if (f.status === 'done') {
        summary.completed += 1;
      } else if (f.status === 'open') {
        if (dueDate < now) {
          summary.overdue += 1;
        } else {
          summary.open += 1;
          if (dueDate >= todayStart && dueDate <= todayEnd) {
            summary.dueToday += 1;
          }
        }
      }
    });

    return res.json(summary);
  } catch (error) {
    console.error('Error fetching followUp summary:', error);
    return res.status(500).json({ message: 'Server error fetching followUp summary' });
  }
};

// POST /api/followups
const createFollowUp = async (req, res) => {
  try {
    const { relatedType, relatedId, dueDate, notes, assignedTo } = req.body;

    if (!relatedType || !relatedId || !dueDate) {
      return res.status(400).json({ message: 'relatedType, relatedId, and dueDate are required' });
    }

    const followUp = await FollowUp.create({
      relatedType,
      relatedId,
      dueDate,
      notes,
      assignedTo: assignedTo || req.user.id,
      status: 'open'
    });

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate('assignedTo', 'name email phone avatarUrl role');

    return res.status(201).json(populatedFollowUp);
  } catch (error) {
    console.error('Error creating followUp:', error);
    return res.status(500).json({ message: 'Server error creating followUp' });
  }
};

// PATCH /api/followups/:id
const updateFollowUpStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const followUp = await FollowUp.findById(id);
    if (!followUp) {
      return res.status(404).json({ message: 'FollowUp not found' });
    }

    followUp.status = status || 'done';
    await followUp.save();

    // Log Activity entry
    await Activity.create({
      relatedType: followUp.relatedType,
      relatedId: followUp.relatedId,
      type: 'status_change',
      description: 'Follow-up marked done',
      createdBy: req.user.id
    });

    return res.json(followUp);
  } catch (error) {
    console.error('Error updating followUp:', error);
    return res.status(500).json({ message: 'Server error updating followUp' });
  }
};

// DELETE /api/followups/:id
const deleteFollowUp = async (req, res) => {
  try {
    const { id } = req.params;

    const followUp = await FollowUp.findById(id);
    if (!followUp) {
      return res.status(404).json({ message: 'FollowUp not found' });
    }

    await followUp.softDelete(req.user.id);
    return res.json({ message: 'Follow-up deleted successfully' });
  } catch (error) {
    console.error('Error deleting followUp:', error);
    return res.status(500).json({ message: 'Server error deleting followUp' });
  }
};

module.exports = {
  getFollowUps,
  getFollowUpSummary,
  createFollowUp,
  updateFollowUpStatus,
  deleteFollowUp
};
