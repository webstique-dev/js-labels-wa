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

    const user = await User.findOne({ email: email.toLowerCase() });

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

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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
  res.clearCookie('token');
  return res.json({ message: 'Logged out successfully' });
};

module.exports = {
  login,
  me,
  logout
};
