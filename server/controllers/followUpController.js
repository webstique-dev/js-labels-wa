const FollowUp = require('../models/FollowUp');
const Activity = require('../models/Activity');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');

// Derive priority from probability score
const derivePriority = (score) => {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};

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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const summary = {
      total: rawFollowUps.length,
      open: 0,
      dueToday: 0,
      overdue: 0,
      completed: 0
    };

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

        // Compute on-the-fly overdue status & summary stats
        const dueDate = new Date(f.dueDate);
        let computedStatus = f.status === 'done' ? 'completed' : f.status;
        if (f.status === 'open') {
          if (dueDate < now) {
            computedStatus = 'overdue';
            summary.overdue += 1;
          } else {
            summary.open += 1;
            if (dueDate >= todayStart && dueDate <= todayEnd) {
              summary.dueToday += 1;
            }
          }
        } else if (f.status === 'done' || f.status === 'completed') {
          summary.completed += 1;
        }

        itemObj.status = computedStatus;
        itemObj.isOverdue = f.status === 'open' && dueDate < now;

        return itemObj;
      })
    );

    // Filter by status if requested
    if (status) {
      populatedItems = populatedItems.filter((i) => (i.status || '').toLowerCase() === status.toLowerCase());
    }

    return res.json({
      followups: populatedItems,
      summary
    });
  } catch (error) {
    console.error('Error fetching followUps list:', error);
    return res.status(500).json({ message: 'Server error fetching followUps' });
  }
};

// GET /api/followups/:id - Fetch single followUp workspace & activity history
const getFollowUpById = async (req, res) => {
  try {
    const { id } = req.params;

    let followUp = await FollowUp.findById(id).populate('assignedTo', 'name email phone avatarUrl role');

    if (!followUp) {
      followUp = await FollowUp.findOne({ relatedId: id }).populate('assignedTo', 'name email phone avatarUrl role');
    }

    // Auto-create followUp if requested via Lead ID
    if (!followUp) {
      const lead = await Lead.findById(id).populate('assignedTo', 'name email phone avatarUrl role');
      if (lead) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        followUp = await FollowUp.create({
          relatedType: 'lead',
          relatedId: lead._id,
          dueDate: tomorrow,
          notes: `Follow up with ${lead.name}`,
          assignedTo: lead.assignedTo?._id || req.user.id,
          status: 'open'
        });
        followUp = await FollowUp.findById(followUp._id).populate('assignedTo', 'name email phone avatarUrl role');
      }
    }

    if (!followUp) {
      return res.status(404).json({ message: 'Follow-up or related Lead record not found' });
    }

    const itemObj = followUp.toObject();
    let relatedRecord = null;
    if (followUp.relatedType === 'lead') {
      const foundLead = await Lead.findById(followUp.relatedId).populate('assignedTo', 'name email phone avatarUrl role');
      if (foundLead) {
        const recObj = foundLead.toObject();
        const Customer = require('../models/Customer');
        const linkedCust = await Customer.findOne({ $or: [{ leadId: foundLead._id }, { phone: foundLead.phone }] });
        if (linkedCust) {
          if (!recObj.gstNo && linkedCust.gstNo) recObj.gstNo = linkedCust.gstNo;
          if (!recObj.address && linkedCust.address) recObj.address = linkedCust.address;
          if (!recObj.city && linkedCust.city) recObj.city = linkedCust.city;
          if (!recObj.company && linkedCust.company) recObj.company = linkedCust.company;
        }
        relatedRecord = recObj;
      }
    } else if (followUp.relatedType === 'customer') {
      const foundCust = await Customer.findById(followUp.relatedId).populate('salesExecutive', 'name email phone avatarUrl role');
      if (foundCust) {
        const recObj = foundCust.toObject();
        const Lead = require('../models/Lead');
        const linkedLead = foundCust.leadId ? await Lead.findById(foundCust.leadId) : await Lead.findOne({ phone: foundCust.phone });
        if (linkedLead) {
          if (!recObj.source && linkedLead.source) recObj.source = linkedLead.source;
          if (!recObj.priority && linkedLead.priority) recObj.priority = linkedLead.priority;
          if (!recObj.gstNo && linkedLead.gstNo) recObj.gstNo = linkedLead.gstNo;
          if (!recObj.address && linkedLead.address) recObj.address = linkedLead.address;
          if (!recObj.city && linkedLead.city) recObj.city = linkedLead.city;
        }
        relatedRecord = recObj;
      }
    }

    itemObj.relatedId = relatedRecord || itemObj.relatedId;
    itemObj.relatedRecord = relatedRecord;

    // Fetch related activity log history
    const history = await Activity.find({
      $or: [
        { relatedId: followUp._id },
        { relatedId: followUp.relatedId }
      ]
    }).populate('createdBy', 'name email avatarUrl role').sort({ createdAt: -1 });

    // Calculate Summary Metrics from DB
    const relatedEntityId = followUp.relatedId;
    const [allFollowUps, openFollowUpsCount] = await Promise.all([
      FollowUp.find({ relatedId: relatedEntityId }),
      FollowUp.countDocuments({ relatedId: relatedEntityId, status: 'open' })
    ]);

    const totalFollowUps = history.length + allFollowUps.length;
    const openFollowUps = openFollowUpsCount > 0 ? openFollowUpsCount : (followUp.status === 'open' ? 1 : 0);
    const lastContacted = history.length > 0 ? history[0].createdAt : (followUp.updatedAt || followUp.createdAt);
    const customerSince = relatedRecord?.createdAt || followUp.createdAt;
    
    let reorderProbability = 85;
    if (relatedRecord && typeof relatedRecord.reorderProbability === 'number' && relatedRecord.reorderProbability > 0) {
      reorderProbability = relatedRecord.reorderProbability;
    } else if (relatedRecord?.priority === 'high') {
      reorderProbability = 85;
    } else if (relatedRecord?.priority === 'medium') {
      reorderProbability = 60;
    } else if (relatedRecord?.priority === 'low') {
      reorderProbability = 30;
    }

    const summaryStats = {
      totalFollowUps,
      openFollowUps,
      lastContacted,
      customerSince,
      reorderProbability,
      nextReorderDate: followUp.dueDate || relatedRecord?.expectedReorderDate || relatedRecord?.nextFollowUpDate
    };

    return res.json({
      followup: itemObj,
      relatedRecord,
      summaryStats,
      history
    });
  } catch (error) {
    console.error('Error fetching followUp details:', error);
    return res.status(500).json({ message: 'Server error fetching followUp details' });
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

// POST /api/followups/:id/log - Log interaction & update follow-up
const logFollowUpInteraction = async (req, res) => {
  try {
    const { id } = req.params;
    const { callStatus, notes, nextFollowupDate } = req.body;

    let followUp = await FollowUp.findById(id);
    if (!followUp) {
      followUp = await FollowUp.findOne({ relatedId: id });
    }

    if (!followUp) {
      return res.status(404).json({ message: 'Follow-up record not found' });
    }

    if (nextFollowupDate) {
      followUp.dueDate = new Date(nextFollowupDate);
    }
    if (notes) {
      followUp.notes = notes;
    }
    followUp.status = 'open';
    await followUp.save();

    // Log Activity Entry
    await Activity.create({
      relatedType: followUp.relatedType,
      relatedId: followUp.relatedId || followUp._id,
      type: 'call',
      description: `[Call ${callStatus || 'connected'}] ${notes || ''}`,
      createdBy: req.user.id
    });

    const updatedFollowUp = await FollowUp.findById(followUp._id).populate('assignedTo', 'name email phone avatarUrl role');

    return res.json({ message: 'Interaction logged successfully', followup: updatedFollowUp });
  } catch (error) {
    console.error('Error logging followUp interaction:', error);
    return res.status(500).json({ message: 'Server error logging interaction' });
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
  getFollowUpById,
  getFollowUpSummary,
  createFollowUp,
  logFollowUpInteraction,
  updateFollowUpStatus,
  deleteFollowUp
};
