const { encrypt, decrypt, buildRequestString, parseResponseString } = require('../../utils/ccavenueCrypto')

/**
 * CCAvenue gateway adapter.
 *
 * Implements the gateway interface consumed by paymentService:
 *   - name
 *   - getConfig()        → { merchantId, accessCode, paymentUrl } (never the working key)
 *   - buildRedirect()    → { paymentUrl, accessCode, encRequest, requestString }
 *   - parseCallback()    → { encResponse, response, normalized }
 *
 * Adding another gateway = another file with the same shape; nothing else changes.
 * All credentials are read from the environment here — never hardcoded, never returned.
 */

function readConfig() {
  const merchantId = process.env.CCA_MERCHANT_ID || process.env.MERCHANT_ID
  const accessCode = process.env.CCA_ACCESS_CODE || process.env.ACCESS_CODE
  const workingKey = process.env.CCA_WORKING_KEY || process.env.WORKING_KEY
  const paymentUrl =
    process.env.CCA_PAYMENT_URL ||
    'https://secure.ccavenue.ae/transaction/transaction.do?command=initiateTransaction'

  if (!merchantId || !accessCode || !workingKey) {
    const err = new Error('CCAvenue is not configured (set CCA_MERCHANT_ID, CCA_ACCESS_CODE, CCA_WORKING_KEY)')
    err.statusCode = 500
    throw err
  }
  return { merchantId, accessCode, workingKey, paymentUrl }
}

const name = 'CCAvenue'

/** Public, non-secret config for status checks. */
function getConfig() {
  const { merchantId, accessCode, paymentUrl } = readConfig()
  return { merchantId, accessCode, paymentUrl }
}

/**
 * Builds the encrypted request to POST to CCAvenue.
 * @param {object} order  { orderId, amount, currency, redirectUrl, cancelUrl, billing, merchantParams }
 */
function buildRedirect(order) {
  const { merchantId, accessCode, workingKey, paymentUrl } = readConfig()
  const b = order.billing || {}

  const params = {
    merchant_id: merchantId,
    order_id: order.orderId,
    currency: order.currency || 'AED',
    amount: Number(order.amount).toFixed(2),
    redirect_url: order.redirectUrl,
    cancel_url: order.cancelUrl,
    language: 'EN',

    billing_name: b.name || 'Customer',
    billing_email: b.email || '',
    billing_tel: b.mobile || '',
    billing_address: b.address || 'NA',
    billing_city: b.city || 'NA',
    billing_state: b.state || 'NA',
    billing_zip: b.pincode || '00000',
    billing_country: b.country || 'United Arab Emirates',

    integration_type: 'iframe_normal',
    merchant_param1: order.merchantParams?.p1 || '',
    merchant_param2: order.merchantParams?.p2 || '',
    merchant_param3: order.merchantParams?.p3 || '',
    merchant_param4: order.merchantParams?.p4 || '',
    merchant_param5: order.merchantParams?.p5 || '',
  }

  const requestString = buildRequestString(params)
  const encRequest = encrypt(requestString, workingKey)
  return { paymentUrl, accessCode, encRequest, requestString }
}

/**
 * Decrypts and normalizes a gateway callback.
 * @param {string} encResponse  the `encResp` field CCAvenue posts back
 */
function parseCallback(encResponse) {
  const { workingKey } = readConfig()
  const decrypted = decrypt(encResponse, workingKey)
  const response = parseResponseString(decrypted)

  // Map CCAvenue's order_status → our internal orderStatus vocabulary.
  const raw = String(response.order_status || '').toLowerCase()
  let normalizedStatus = 'PENDING'
  if (raw === 'success') normalizedStatus = 'SUCCESS'
  else if (raw === 'aborted' || raw === 'cancelled' || raw === 'canceled') normalizedStatus = 'CANCELLED'
  else if (raw === 'failure' || raw === 'invalid') normalizedStatus = 'FAILED'

  return {
    encResponse,
    response,
    normalized: {
      orderId: response.order_id || null,
      trackingId: response.tracking_id || null,
      bankRefNo: response.bank_ref_no || null,
      orderStatus: normalizedStatus,
      gatewayOrderStatus: response.order_status || null,
      paymentMode: response.payment_mode || null,
      amount: response.amount != null ? Number(response.amount) : null,
      currency: response.currency || null,
      failureMessage: response.failure_message || response.status_message || null,
      merchantId: response.merchant_id || null,
      billing: {
        name: response.billing_name || null,
        email: response.billing_email || null,
        mobile: response.billing_tel || null,
        address: response.billing_address || null,
        city: response.billing_city || null,
        state: response.billing_state || null,
        country: response.billing_country || null,
        pincode: response.billing_zip || null,
      },
    },
  }
}

module.exports = { name, getConfig, buildRedirect, parseCallback }
