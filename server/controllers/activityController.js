const Activity = require('../models/Activity');

// GET /api/activities?relatedType=lead&relatedId=:id
const getActivities = async (req, res) => {
  try {
    const { relatedType, relatedId } = req.query;

    if (!relatedType || !relatedId) {
      return res.status(400).json({ message: 'relatedType and relatedId are required' });
    }

    const activities = await Activity.find({ relatedType, relatedId })
      .populate('createdBy', 'name email avatarUrl role')
      .sort({ createdAt: -1 });

    return res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return res.status(500).json({ message: 'Server error fetching activities' });
  }
};

// POST /api/activities
const createActivity = async (req, res) => {
  try {
    const { relatedType, relatedId, type, description, fileName, fileUrl } = req.body;

    if (!relatedType || !relatedId || !type || !description) {
      return res.status(400).json({ message: 'relatedType, relatedId, type, and description are required' });
    }

    const activity = await Activity.create({
      relatedType,
      relatedId,
      type,
      description,
      fileName,
      fileUrl,
      createdBy: req.user.id
    });

    const populatedActivity = await Activity.findById(activity._id)
      .populate('createdBy', 'name email avatarUrl role');

    return res.status(201).json(populatedActivity);
  } catch (error) {
    console.error('Error creating activity:', error);
    return res.status(500).json({ message: 'Server error creating activity' });
  }
};

// POST /api/activities/upload
const uploadActivityFile = async (req, res) => {
  try {
    const { relatedType, relatedId, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileName = req.file.originalname;
    const fileUrl = `/uploads/${req.file.filename}`;

    const activity = await Activity.create({
      relatedType: relatedType || 'lead',
      relatedId,
      type: 'note',
      description: description || `Uploaded file: ${fileName}`,
      fileName,
      fileUrl,
      createdBy: req.user.id
    });

    const populatedActivity = await Activity.findById(activity._id)
      .populate('createdBy', 'name email avatarUrl role');

    return res.status(201).json(populatedActivity);
  } catch (error) {
    console.error('Error uploading activity file:', error);
    return res.status(500).json({ message: 'Server error uploading file' });
  }
};

module.exports = {
  getActivities,
  createActivity,
  uploadActivityFile
};
