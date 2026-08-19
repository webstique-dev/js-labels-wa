const Escalation = require('../models/Escalation');
const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const User = require('../models/User');

// GET /api/escalations?stage=md_review
const getEscalations = async (req, res) => {
  try {
    const { stage = 'md_review' } = req.query;

    const escalations = await Escalation.find({ stage })
      .populate({
        path: 'followUpId',
        populate: [
          { path: 'assignedTo', select: 'name email phone avatarUrl role' },
          { path: 'relatedId' }
        ]
      })
      .populate('resolvedBy', 'name email')
      .populate('reassignedTo', 'name email')
      .sort({ updatedAt: -1 });

    return res.json(escalations);
  } catch (error) {
    console.error('Error fetching escalations:', error);
    return res.status(500).json({ message: 'Server error fetching escalations' });
  }
};

// POST /api/escalations/:id/reassign
const reassignEscalatedLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { reassignedTo } = req.body;

    if (!reassignedTo) {
      return res.status(400).json({ message: 'reassignedTo user ID is required' });
    }

    const targetUser = await User.findById(reassignedTo);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target executive user not found' });
    }

    const escalation = await Escalation.findById(id).populate('followUpId');
    if (!escalation) {
      return res.status(404).json({ message: 'Escalation record not found' });
    }

    const followUp = escalation.followUpId;
    if (followUp && followUp.relatedType === 'lead') {
      const lead = await Lead.findById(followUp.relatedId);
      if (lead) {
        lead.assignedTo = reassignedTo;
        await lead.save();

        await Activity.create({
          relatedType: 'lead',
          relatedId: lead._id,
          type: 'status_change',
          description: `Lead reassigned to ${targetUser.name} by Super Admin via Escalation Review`,
          createdBy: req.user.id
        });
      }
    }

    escalation.stage = 'reassignment';
    escalation.resolvedAt = new Date();
    escalation.resolvedBy = req.user.id;
    escalation.reassignedTo = reassignedTo;
    await escalation.save();

    return res.json({ message: 'Lead reassigned and escalation resolved successfully', escalation });
  } catch (error) {
    console.error('Error reassigning escalated lead:', error);
    return res.status(500).json({ message: 'Server error reassigning lead' });
  }
};

module.exports = {
  getEscalations,
  reassignEscalatedLead
};
