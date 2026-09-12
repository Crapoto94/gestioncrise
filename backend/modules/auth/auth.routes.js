const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./auth.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = express.Router();

// Limitation de débit sur l'auth (endpoint sensible, cf. GUIDE §6 Sécurité).
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Authentifie un agent (AD via APM, ou compte de secours local)
 *     tags: [Auth]
 */
router.post('/login', loginLimiter, controller.login);

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     summary: Retourne l'utilisateur courant à partir du JWT applicatif
 *     tags: [Auth]
 */
router.get('/me', requireAuth, controller.me);

module.exports = router;
