/**
 * OpenAPI path definitions for Mobile v1 products endpoints.
 * Merge into swagger/allPaths.js or mount as separate spec at /api-docs/mobile.
 */

function getMobileProductPaths() {
  return {
    '/api/v1/mobile/products': {
      get: {
        tags: ['Mobile - Products'],
        summary: 'List products (mobile-optimized)',
        description:
          'Returns a paginated list of active products with minimal fields for mobile feeds.\n\n' +
          '**Shared service:** `productService.listProducts`\n\n' +
          '**Database:** `products`, `categories`, `users` (savedProducts)',
        parameters: [
          { name: 'categoryId', in: 'query', schema: { type: 'string' }, description: 'MongoDB ObjectId' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 50 } },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['newest', 'price_asc', 'price_desc'] },
          },
          { name: 'Authorization', in: 'header', schema: { type: 'string' }, description: 'Bearer JWT (optional)' },
          { name: 'X-App-Version', in: 'header', required: true, schema: { type: 'string', example: '1.0.0' } },
          { name: 'X-Platform', in: 'header', required: true, schema: { type: 'string', enum: ['ios', 'android'] } },
        ],
        responses: {
          200: {
            description: 'Paginated product list',
            content: {
              'application/json': {
                example: {
                  success: true,
                  message: 'Products fetched',
                  data: {
                    items: [
                      {
                        id: '64a1b2c3d4e5f6a7b8c9d0e1',
                        title: 'iPhone 14 Pro',
                        price: 3500,
                        currency: 'AED',
                        thumbnail: 'https://cdn.example.com/thumb.jpg',
                        location: 'Dubai',
                        saved: false,
                        postedAt: '2026-05-20T10:00:00.000Z',
                      },
                    ],
                  },
                  meta: { page: 1, limit: 20, total: 142, hasMore: true },
                },
              },
            },
          },
          400: { description: 'Validation error' },
          401: { description: 'Invalid token' },
        },
      },
    },
    '/api/v1/mobile/products/{id}': {
      get: {
        tags: ['Mobile - Products'],
        summary: 'Get product detail (mobile)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'Authorization', in: 'header', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Product detail' },
          404: { description: 'Product not found' },
        },
      },
    },
  }
}

module.exports = { getMobileProductPaths }
