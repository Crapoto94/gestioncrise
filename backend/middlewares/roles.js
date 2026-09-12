// RBAC simple par rôle applicatif (DSI, RSSI, IRS, SSD, BDP, DGS, DIRECTION,
// ELU, DPO — cf. 00_VISION_PRODUIT.md). req.user.roles est peuplé au login
// par modules/auth (voir auth.service.js).
const { HttpError } = require('./errorHandler');

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const isAllowed = userRoles.some((r) => allowedRoles.includes(r));
    if (!isAllowed) {
      return next(new HttpError(403, `Rôle requis: ${allowedRoles.join(' ou ')}`));
    }
    next();
  };
}

module.exports = { requireRole };
