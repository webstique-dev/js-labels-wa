const applyOwnershipScope = (field = 'assignedTo') => {
  return (req, res, next) => {
    if (!req.user) {
      req.scopeFilter = {};
      return next();
    }

    if (req.user.role === 'caller') {
      req.scopeFilter = { [field]: req.user.id };
    } else {
      req.scopeFilter = {};
    }

    next();
  };
};

module.exports = { applyOwnershipScope };
