const { buildPaths, getTagDefinitions } = require('./allPaths')

/**
 * @param {{ baseUrl: string }} opts
 */
function buildSpec (opts) {
  const baseUrl = (opts && opts.baseUrl) || 'http://localhost:5002'
  return {
    openapi: '3.0.3',
    info: {
      title: 'Marketplace API',
      version: '1.0.0',
      description:
        'Full REST surface for the OLX/Dubizzle-style marketplace backend.\n\n' +
        '- **Auth:** Use **Authorize** with a JWT from `POST /api/auth/login` or `POST /api/auth/verify-email-otp`. The SPA may also send the same token as an HTTP-only cookie (Try it out uses the header).\n' +
        '- **Admin:** Same bearer token; user must have admin role.\n' +
        '- **WebSocket:** Real-time chat uses Socket.IO (not part of OpenAPI). Events include `join-user`, `join-room`, `leave-room`, `new-message`, `unread-updated`.\n' +
        '- **Route list:** See `API_LIST.md` in the repo root; OpenAPI paths are generated from `server/swagger/allPaths.js`.',
    },
    servers: [{ url: baseUrl, description: 'Server root' }],
    tags: getTagDefinitions(),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT from login or email verification. Send as `Authorization: Bearer <token>`. Cookies are not sent from Swagger Try it by default.',
        },
      },
    },
    paths: buildPaths(),
  }
}

/**
 * Mount Swagger UI at /api-docs (static assets + spec).
 * @param {import('express').Application} app
 * @param {{ baseUrl?: string }} [opts]
 */
function mountSwagger (app, opts = {}) {
  const swaggerUi = require('swagger-ui-express')
  const spec = buildSpec({ baseUrl: opts.baseUrl })
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
      },
    }),
  )
  app.get('/api-docs.json', (req, res) => {
    res.json(spec)
  })
}

module.exports = { buildSpec, mountSwagger }
