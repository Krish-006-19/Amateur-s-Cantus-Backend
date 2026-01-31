const jwt = require('jsonwebtoken');
const Admin = require('../models/admin.model');
const Auth = require('../models/auth.model');

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

async function optionalUser(req, _res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return next();

    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload = jwt.verify(token, secret);

    const user = await Auth.findById(payload.sub);
    if (!user) return next();

    req.user = user;
    req.userRole = payload.role || user.role;
    return next();
  } catch (_err) {
    return next();
  }
}

async function requireUser(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload = jwt.verify(token, secret);

    const user = await Auth.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (user.status && user.status !== 'active') return res.status(403).json({ message: 'Account is suspended' });

    req.user = user;
    req.userRole = payload.role || user.role;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

async function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  if (process.env.ADMIN_KEY && adminKey && adminKey === process.env.ADMIN_KEY) {
    return next();
  }

  try {
    await requireUser(req, res, async () => {
      if (req.userRole === 'admin') return next();

      const adminDoc = await Admin.findOne({ authDetails: req.user._id });
      if (!adminDoc) return res.status(403).json({ message: 'Forbidden' });

      req.userRole = 'admin';
      return next();
    });
  } catch (_err) {
    return res.status(403).json({ message: 'Forbidden' });
  }
}

module.exports = { optionalUser, requireUser, requireAdmin };
