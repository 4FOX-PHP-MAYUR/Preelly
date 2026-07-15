const express = require('express')
const router = express.Router()
const { body, param } = require('express-validator')

const paymentService = require('../core/services/paymentService')
const authMiddleware = require('../middleware/auth')
const validateRequest = require('../middleware/validateRequest')
const { toPaymentTransactionDto } = require('../dto/paymentTransaction.dto')
const logger = require('../utils/paymentLogger')

function baseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`
}
function frontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:8030'
}

/**
 * POST /api/payment/initiate  (JWT)
 * Validates the order, creates an INITIATED transaction, and returns the encrypted
 * CCAvenue redirect for the browser to POST. The amount is computed server-side.
 */
router.post(
  '/initiate',
  authMiddleware,
  [
    body('productId').exists().withMessage('productId is required').isMongoId(),
    body('packageId').exists().withMessage('packageId is required').isMongoId(),
    body('storageFacilityId').optional({ nullable: true }).isMongoId(),
    body('couponCode').optional({ nullable: true }).isString().trim(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const result = await paymentService.initiatePayment({
        userId: req.user._id,
        user: req.user,
        productId: req.body.productId,
        packageId: req.body.packageId,
        storageFacilityId: req.body.storageFacilityId || null,
        couponCode: req.body.couponCode || null,
        baseUrl: baseUrl(req),
        frontendUrl: frontendUrl(),
        context: {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
          requestTime: new Date(),
        },
      })
      res.json({
        success: true,
        message: 'Payment initiated',
        data: {
          orderId: result.orderId,
          amount: result.amount,
          currency: result.currency,
          paymentUrl: result.paymentUrl,
          accessCode: result.accessCode,
          encRequest: result.encRequest,
        },
      })
    } catch (error) {
      logger.error('payment.initiate_failed', { message: error.message, userId: String(req.user?._id) })
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to initiate payment',
      })
    }
  }
)

/**
 * POST /api/payment/ccavenue/callback  (public — CCAvenue posts here)
 * Decrypts, verifies, updates the transaction, then 302-redirects the browser to the
 * success/failure page. Never trusts anything except the decrypted response.
 */
async function handleCallback(req, res) {
  const encResponse = req.body?.encResp
  const fe = frontendUrl()
  try {
    const { txn, status } = await paymentService.processCallback({
      gatewayName: 'CCAvenue',
      encResponse,
      context: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null,
        callbackTime: new Date(),
        baseUrl: baseUrl(req),
      },
    })
    const page = status === 'SUCCESS' ? 'success' : 'failure'
    return res.redirect(`${fe}/post-ad/payment/${page}?orderId=${encodeURIComponent(txn.orderId)}`)
  } catch (error) {
    logger.error('payment.callback_failed', { message: error.message })
    // Send the user somewhere sensible even when the callback can't be matched.
    return res.redirect(`${fe}/post-ad/payment/failure?error=${encodeURIComponent(error.message || 'callback_error')}`)
  }
}

router.post('/ccavenue/callback', express.urlencoded({ extended: true }), handleCallback)
router.post('/ccavenue/cancel', express.urlencoded({ extended: true }), handleCallback)

/**
 * GET /api/payment/transaction/:orderId  (JWT)
 * Fetches a transaction for the success/failure pages. Owner only.
 */
router.get(
  '/transaction/:orderId',
  authMiddleware,
  [param('orderId').exists().isString().trim().notEmpty()],
  validateRequest,
  async (req, res) => {
    try {
      const txn = await paymentService.getTransactionForUser(req.params.orderId, req.user._id)
      res.json({ success: true, message: 'Transaction fetched', data: toPaymentTransactionDto(txn) })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch transaction',
      })
    }
  }
)

/**
 * GET /api/payment/invoice/:orderId  (JWT)
 * Streams the invoice PDF. Owner-only; regenerates the file if missing. The file
 * lives outside the public /uploads mount, so it is never reachable by path.
 */
router.get(
  '/invoice/:orderId',
  authMiddleware,
  [param('orderId').exists().isString().trim().notEmpty()],
  validateRequest,
  async (req, res) => {
    try {
      const { invoicePath, invoiceNumber } = await paymentService.getInvoiceForUser(
        req.params.orderId,
        req.user._id,
        { baseUrl: baseUrl(req) }
      )
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`)
      return res.sendFile(invoicePath)
    } catch (error) {
      logger.error('payment.invoice_download_failed', { orderId: req.params.orderId, message: error.message })
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to download invoice',
      })
    }
  }
)

module.exports = router
