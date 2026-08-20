const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const User = require('../models/User');
const FollowUp = require('../models/FollowUp');

// GET /api/leads
const getLeads = async (req, res) => {
  try {
    const { status, source, assignedTo, page = 1, limit = 50 } = req.query;

    // Base filter starting with ownership scope filter
    let queryFilter = { ...req.scopeFilter };

    if (status) queryFilter.status = status;
    if (source) queryFilter.source = source;

    // If manager/super_admin passes assignedTo, apply it unless caller scope already locks it
    if (assignedTo && req.user.role !== 'caller') {
      queryFilter.assignedTo = assignedTo;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [leads, total] = await Promise.all([
      Lead.find(queryFilter)
        .populate('assignedTo', 'name email avatarUrl role')
        .populate('createdBy', 'name email avatarUrl role')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Lead.countDocuments(queryFilter)
    ]);

    return res.json({
      leads,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return res.status(500).json({ message: 'Server error fetching leads' });
  }
};

// POST /api/leads
const createLead = async (req, res) => {
  try {
    const { name, company, phone, email, source, priority, assignedTo } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Lead name and phone number are required' });
    }

    const cleanPhone = phone.toString().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: 'Please enter a valid email address' });
      }
    }

    const finalAssignedTo = req.user.role === 'caller' ? req.user.id : (assignedTo || req.user.id);
    const finalSource = (source && source.trim()) ? source.trim() : null;

    const newLead = await Lead.create({
      name: name.trim(),
      company: company ? company.trim() : undefined,
      phone: cleanPhone,
      email: email ? email.trim().toLowerCase() : undefined,
      source: finalSource,
      priority: priority || 'medium',
      status: 'new',
      assignedTo: finalAssignedTo,
      createdBy: req.user.id
    });

    // Create activity audit entry
    await Activity.create({
      relatedType: 'lead',
      relatedId: newLead._id,
      type: 'status_change',
      description: 'Lead created',
      createdBy: req.user.id
    });

    const populatedLead = await Lead.findById(newLead._id)
      .populate('assignedTo', 'name email avatarUrl role')
      .populate('createdBy', 'name email avatarUrl role');

    return res.status(201).json(populatedLead);
  } catch (error) {
    console.error('Error creating lead:', error);
    return res.status(500).json({ message: 'Server error creating lead' });
  }
};

// PATCH /api/leads/:id/status
const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancelReason, followUpDate, followUpTime, notes } = req.body;

    const validStatuses = ['new', 'contacted', 'follow_up', 'won', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid lead status' });
    }

    if (status === 'cancelled' && (!cancelReason || !cancelReason.trim())) {
      return res.status(400).json({ message: 'Cancellation reason is required when cancelling a lead' });
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Ownership check for caller
    if (req.user.role === 'caller' && lead.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only update leads assigned to you' });
    }

    const ALLOWED_TRANSITIONS = {
      new: ['contacted', 'follow_up', 'won', 'cancelled'],
      contacted: ['new', 'follow_up', 'won', 'cancelled'],
      follow_up: ['new', 'contacted', 'follow_up', 'won', 'cancelled'],
      won: ['new', 'contacted', 'follow_up', 'cancelled'],
      cancelled: ['new', 'contacted', 'follow_up', 'won']
    };

    const oldStatus = lead.status || 'new';

    if (oldStatus !== status) {
      const allowedNext = ALLOWED_TRANSITIONS[oldStatus] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          message: `Invalid lead status transition from '${oldStatus}' to '${status}'`
        });
      }
    }

    lead.status = status;
    if (status === 'cancelled') {
      lead.cancelReason = cancelReason;
    } else {
      lead.cancelReason = undefined;
    }

    await lead.save();

    // If moving to follow_up, create a FollowUp document to sync with Followups List and Details pages
    if (status === 'follow_up') {
      let dueDate = new Date();
      if (followUpDate && followUpTime) {
        dueDate = new Date(`${followUpDate}T${followUpTime}`);
      } else if (followUpDate) {
        dueDate = new Date(followUpDate);
      }

      await FollowUp.create({
        relatedType: 'lead',
        relatedId: lead._id,
        dueDate: isNaN(dueDate.getTime()) ? new Date() : dueDate,
        notes: notes || '',
        status: 'open',
        assignedTo: lead.assignedTo || req.user.id
      });
    }

    // If moving to won, create a Customer document if not already existing
    if (status === 'won') {
      const Customer = require('../models/Customer');
      const existingCust = await Customer.findOne({ $or: [{ leadId: lead._id }, { phone: lead.phone }] });
      if (!existingCust) {
        await Customer.create({
          name: lead.name,
          company: lead.company,
          phone: lead.phone,
          email: lead.email,
          leadId: lead._id,
          salesExecutive: lead.assignedTo || req.user.id,
          customerType: 'Regular',
          paymentTerms: '30 Days',
          reorderProbability: 75,
          expectedReorderDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
      }
    }

    // Create activity audit entry
    await Activity.create({
      relatedType: 'lead',
      relatedId: lead._id,
      type: 'status_change',
      description: `Moved status from ${oldStatus} to ${status}`,
      createdBy: req.user.id
    });

    const updatedLead = await Lead.findById(lead._id)
      .populate('assignedTo', 'name email avatarUrl role')
      .populate('createdBy', 'name email avatarUrl role');

    return res.json(updatedLead);
  } catch (error) {
    console.error('Error updating lead status:', error);
    return res.status(500).json({ message: 'Server error updating lead status' });
  }
};

// PATCH /api/leads/:id/assign
const reassignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ message: 'assignedTo user ID is required' });
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const targetUser = await User.findById(assignedTo);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user for assignment not found' });
    }

    lead.assignedTo = assignedTo;
    await lead.save();

    await Activity.create({
      relatedType: 'lead',
      relatedId: lead._id,
      type: 'status_change',
      description: `Reassigned lead to ${targetUser.name}`,
      createdBy: req.user.id
    });

    const updatedLead = await Lead.findById(lead._id)
      .populate('assignedTo', 'name email avatarUrl role')
      .populate('createdBy', 'name email avatarUrl role');

    return res.json(updatedLead);
  } catch (error) {
    console.error('Error reassigning lead:', error);
    return res.status(500).json({ message: 'Server error reassigning lead' });
  }
};

// POST /api/leads/:id/activity
const addLeadActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, description } = req.body;

    if (!type || !description) {
      return res.status(400).json({ message: 'Activity type and description are required' });
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    if (req.user.role === 'caller' && lead.assignedTo?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only add activity to your assigned leads' });
    }

    const activity = await Activity.create({
      relatedType: 'lead',
      relatedId: lead._id,
      type,
      description,
      createdBy: req.user.id
    });

    // Touch lead updatedAt timestamp
    lead.updatedAt = new Date();
    await lead.save();

    return res.status(201).json(activity);
  } catch (error) {
    console.error('Error adding activity:', error);
    return res.status(500).json({ message: 'Server error adding activity' });
  }
};

// GET /api/leads/:id
const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findById(id)
      .populate('assignedTo', 'name email phone avatarUrl role')
      .populate('createdBy', 'name email phone avatarUrl role');

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Ownership check for caller
    if (req.user.role === 'caller' && lead.assignedTo?._id?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only view leads assigned to you' });
    }

    return res.json(lead);
  } catch (error) {
    console.error('Error fetching lead detail:', error);
    return res.status(500).json({ message: 'Server error fetching lead detail' });
  }
};

// DELETE /api/leads/:id
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    await lead.softDelete(req.user.id);

    await Activity.create({
      relatedType: 'lead',
      relatedId: lead._id,
      type: 'status_change',
      description: `Lead ${lead.name} soft deleted`,
      createdBy: req.user.id
    });

    return res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return res.status(500).json({ message: 'Server error deleting lead' });
  }
};

module.exports = {
  getLeads,
  getLeadById,
  createLead,
  updateLeadStatus,
  reassignLead,
  addLeadActivity,
  deleteLead
};
