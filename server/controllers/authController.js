const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const permissions = require('../config/permissions');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d',
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Account is inactive. Contact Administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user._id, user.role);
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const userPermissions = permissions[user.role] || {};

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        status: user.status
      },
      permissions: userPermissions
    });
  } catch (error) {
    console.error('Login Controller Error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;

    if (!name || !email || !role || !password) {
      return res.status(400).json({ message: 'Name, email, role, and password are required' });
    }

    const validRoles = ['super_admin', 'manager', 'caller'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role selected. Must be super_admin, manager, or caller.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: 'A user account with this email address already exists.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
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

    return res.status(201).json({
      message: 'Account created successfully! You can now log in.',
      user: userObj
    });
  } catch (error) {
    console.error('Register Controller Error:', error);
    return res.status(500).json({ message: 'Server error during registration' });
  }
};

const me = async (req, res) => {
  try {
    const userPermissions = permissions[req.user.role] || {};
    return res.json({
      user: req.user,
      role: req.user.role,
      permissions: userPermissions
    });
  } catch (error) {
    console.error('Me Controller Error:', error);
    return res.status(500).json({ message: 'Server error fetching profile' });
  }
};

const logout = async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax'
  });
  return res.json({ message: 'Logged out successfully' });
};

module.exports = {
  login,
  register,
  me,
  logout
};
