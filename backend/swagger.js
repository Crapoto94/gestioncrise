// Documentation interactive Swagger (cf. GUIDE §5 "Documentation & API").
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PGC — Plateforme de Gestion de Crise',
      version: '0.1.0',
      description: 'API de la plateforme de gestion de crise et de continuité pour la Ville.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./modules/**/*.routes.js'],
};

module.exports = swaggerJsdoc(options);
