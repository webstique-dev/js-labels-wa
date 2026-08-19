const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Activity = require('../models/Activity');

// GET /api/users
const getUsers = async (req, res) => {
  try {
    const { role, status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;

    const users = await User.find(filter).select('-passwordHash').sort({ createdAt: -1 });
    return res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Server error fetching users' });
  }
};

// POST /api/users - Create User
const createUser = async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;

    if (!name || !email || !role || !password) {
      return res.status(400).json({ message: 'Name, email, role, and password are required' });
    }

    const validRoles = ['super_admin', 'manager', 'caller'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be super_admin, manager, or caller.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email address already exists' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : '',
      role,
      passwordHash,
      status: 'active'
    });

    const userObj = user.toObject();
    delete userObj.passwordHash;

    return res.status(201).json(userObj);
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ message: 'Server error creating user' });
  }
};

// PATCH /api/users/:id - Edit User Details
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, status, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUserId = req.user.id || req.user._id?.toString();
    if (currentUserId === id && status === 'inactive') {
      return res.status(403).json({ message: 'You cannot deactivate your own logged-in account' });
    }

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone ? phone.trim() : '';
    if (role) {
      const validRoles = ['super_admin', 'manager', 'caller'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified' });
      }
      user.role = role;
    }
    if (status) user.status = status;

    if (email && email.toLowerCase().trim() !== user.email) {
      const cleanEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: cleanEmail });
      if (existing && existing._id.toString() !== id) {
        return res.status(400).json({ message: 'Email address already in use by another user' });
      }
      user.email = cleanEmail;
    }

    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password.trim(), salt);
    }

    await user.save();

    const userObj = user.toObject();
    delete userObj.passwordHash;

    return res.json(userObj);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ message: 'Server error updating user' });
  }
};

// PATCH /api/users/:id/deactivate
const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id || req.user._id?.toString();

    if (currentUserId === id) {
      return res.status(403).json({ message: 'You cannot deactivate your own logged-in account' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check open leads and open followups
    const openLeads = await Lead.find({ assignedTo: id, status: { $in: ['new', 'contacted', 'follow_up'] } }).select('name company phone status');
    const openFollowUps = await FollowUp.find({ assignedTo: id, status: 'open' }).select('relatedType relatedId dueDate notes');

    if (openLeads.length > 0 || openFollowUps.length > 0) {
      return res.json({
        hasOpenItems: true,
        openLeadsCount: openLeads.length,
        openFollowUpsCount: openFollowUps.length,
        openLeads,
        openFollowUps
      });
    }

    user.status = 'inactive';
    await user.save();

    return res.json({ hasOpenItems: false, message: `User ${user.name} deactivated successfully` });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return res.status(500).json({ message: 'Server error deactivating user' });
  }
};

// PATCH /api/users/:id/activate
const activateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'active';
    await user.save();

    return res.json({ message: `User ${user.name} activated successfully` });
  } catch (error) {
    console.error('Error activating user:', error);
    return res.status(500).json({ message: 'Server error activating user' });
  }
};

// PATCH /api/users/:id/password - Update User Password
const updateUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.trim().length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password.trim(), salt);
    await user.save();

    return res.json({ message: `Password for ${user.name} updated successfully` });
  } catch (error) {
    console.error('Error updating user password:', error);
    return res.status(500).json({ message: 'Server error updating user password' });
  }
};

// POST /api/users/:id/reassign-and-deactivate
const reassignAndDeactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reassignTo } = req.body;
    const currentUserId = req.user.id || req.user._id?.toString();

    if (currentUserId === id) {
      return res.status(403).json({ message: 'You cannot deactivate your own logged-in account' });
    }

    if (!reassignTo) {
      return res.status(400).json({ message: 'Target executive for reassignment is required' });
    }

    const targetUser = await User.findById(reassignTo);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target executive user not found' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User to deactivate not found' });
    }

    // 1. Reassign open leads
    const openLeads = await Lead.find({ assignedTo: id, status: { $in: ['new', 'contacted', 'follow_up'] } });
    for (const lead of openLeads) {
      lead.assignedTo = reassignTo;
      await lead.save();

      await Activity.create({
        relatedType: 'lead',
        relatedId: lead._id,
        type: 'status_change',
        description: `Lead reassigned from ${user.name} to ${targetUser.name} due to user deactivation`,
        createdBy: req.user.id
      });
    }

    // 2. Reassign open followups
    await FollowUp.updateMany(
      { assignedTo: id, status: 'open' },
      { $set: { assignedTo: reassignTo } }
    );

    // 3. Set user status to inactive
    user.status = 'inactive';
    await user.save();

    return res.json({
      message: `Reassigned open items to ${targetUser.name}, user ${user.name} deactivated.`
    });
  } catch (error) {
    console.error('Error reassigning and deactivating user:', error);
    return res.status(500).json({ message: 'Server error reassigning and deactivating user' });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id || req.user._id?.toString();

    if (currentUserId === id) {
      return res.status(403).json({ message: 'You cannot delete your own logged-in account' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check open leads and open followups first
    const openLeads = await Lead.find({ assignedTo: id, status: { $in: ['new', 'contacted', 'follow_up'] } }).select('name company phone status');
    const openFollowUps = await FollowUp.find({ assignedTo: id, status: 'open' }).select('relatedType relatedId dueDate notes');

    if (openLeads.length > 0 || openFollowUps.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete user with active leads or follow-ups. Please reassign open items first.',
        hasOpenItems: true,
        openLeadsCount: openLeads.length,
        openFollowUpsCount: openFollowUps.length,
        openLeads,
        openFollowUps
      });
    }

    await user.softDelete(req.user.id);
    return res.json({ message: `User ${user.name} deleted successfully` });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Server error deleting user' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  updateUserPassword,
  reassignAndDeactivateUser,
  deleteUser
};
