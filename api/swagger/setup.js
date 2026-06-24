const { buildPaths, getTagDefinitions } = require('./allPaths')

/**
 * @param {{ baseUrl: string }} opts
 */
function buildSpec (opts) {
  const baseUrl = (opts && opts.baseUrl) || 'http://localhost:8029'
  return {
    openapi: '3.0.3',
    info: {
      title: 'Preelly API',
      version: '1.0.0',
      description:
        'Full REST surface for the Preelly marketplace backend.\n\n' +
        '- **Auth:** Use **Authorize** with a JWT from `POST /api/auth/verify-otp` (email or WhatsApp), `POST /api/auth/verify-email-otp`, or signup verification flows. The SPA may also send the same token as an HTTP-only cookie (Try it out uses the header).\n' +
        '- **OTP channels:** `POST /api/auth/send-otp` accepts `channel: "email" | "whatsapp"`. WhatsApp login requires `phone`, optional `phoneCountryCode` / `phoneCountryIso`, and `mode: "login"`.\n' +
        '- **Admin:** Same bearer token; user must have admin role.\n' +
        '- **WebSocket:** Real-time chat uses Socket.IO (not part of OpenAPI). Events include `join-user`, `join-room`, `leave-room`, `new-message`, `unread-updated`.\n' +
        '- **Route lists:** See `api/docs/API_List_Mobile.xlsx` and `api/docs/API_List_Web.xlsx`; OpenAPI paths are generated from `api/swagger/allPaths.js`.',
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
            'JWT from verify-otp or email/phone verification. Send as `Authorization: Bearer <token>`. Cookies are not sent from Swagger Try it by default.',
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
