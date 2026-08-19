const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.id).select('-passwordHash');
    
    if (!user || user.status === 'inactive') {
      return res.status(401).json({ message: 'User is inactive or not found' });
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      status: user.status
    };

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};

module.exports = { protect };
