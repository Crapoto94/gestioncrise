// Vérifie le JWT applicatif (émis par modules/auth après succès AD/APM ou
// compte local de secours). Ne jamais confondre avec les jetons APM/Hub DSI
// qui servent aux appels sortants — celui-ci gère uniquement la session
// interne de l'application (cf. GUIDE §3.1.b et §4.4).
const jwt = require('jsonwebtoken');
const { HttpError } = require('./errorHandler');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentification requise'));

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    next(new HttpError(401, 'Jeton invalide ou expiré'));
  }
}

module.exports = { requireAuth };
