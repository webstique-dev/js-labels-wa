const Settings = require('../models/Settings');

// GET /api/settings
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ singleton: true });
    if (!settings) {
      settings = await Settings.create({
        reminderLeadDays: [7, 3, 0],
        escalationDelaysHours: { warning: 24, escalation: 48, mdReview: 72 },
        singleton: true
      });
    }
    return res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ message: 'Server error fetching settings' });
  }
};

// PATCH /api/settings
const updateSettings = async (req, res) => {
  try {
    const { reminderLeadDays, escalationDelaysHours, notificationTemplates, autoAssignmentRule } = req.body;

    let settings = await Settings.findOne({ singleton: true });
    if (!settings) {
      settings = new Settings({ singleton: true });
    }

    if (escalationDelaysHours) {
      const { warning, escalation, mdReview } = escalationDelaysHours;
      const w = parseInt(warning);
      const e = parseInt(escalation);
      const m = parseInt(mdReview);

      if (isNaN(w) || isNaN(e) || isNaN(m) || !(w < e && e < m)) {
        return res.status(400).json({
          message: 'Escalation delay hours must be strictly ascending (Warning < Escalation < MD Review)'
        });
      }

      settings.escalationDelaysHours = { warning: w, escalation: e, mdReview: m };
    }

    if (reminderLeadDays && Array.isArray(reminderLeadDays)) {
      settings.reminderLeadDays = reminderLeadDays.map(d => parseInt(d)).filter(d => !isNaN(d));
    }

    if (notificationTemplates) {
      settings.notificationTemplates = {
        ...settings.notificationTemplates,
        ...notificationTemplates
      };
    }

    if (autoAssignmentRule && ['round_robin', 'load_based'].includes(autoAssignmentRule)) {
      settings.autoAssignmentRule = autoAssignmentRule;
    }

    await settings.save();
    return res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ message: 'Server error updating settings' });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
