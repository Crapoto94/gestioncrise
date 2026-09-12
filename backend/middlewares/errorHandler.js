// Gestionnaire d'erreurs centralisé — corps normalisé { error: "..." },
// jamais de fuite de stack trace en production.
function notFound(req, res) {
  res.status(404).json({ error: `Route introuvable: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  if (status >= 500) {
    console.error('[error]', err);
  }
  res.status(status).json({
    error: err.publicMessage || err.message || 'Erreur interne',
    ...(isProd ? {} : { stack: err.stack }),
  });
}

class HttpError extends Error {
  constructor(status, message, publicMessage) {
    super(message);
    this.status = status;
    this.publicMessage = publicMessage || message;
  }
}

module.exports = { notFound, errorHandler, HttpError };
