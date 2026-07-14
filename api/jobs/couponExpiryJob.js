const couponService = require('../core/services/couponService')

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000 // hourly

/**
 * Flips expired coupons to inactive.
 *
 * Redemption is already blocked past `endDate` at validation time — this sweep exists
 * so the admin list reflects reality rather than showing expired coupons as "Active".
 * Runs on an interval rather than a cron dependency, matching the rest of jobs/.
 */
function startCouponExpiryJob({ intervalMs = Number(process.env.COUPON_EXPIRY_INTERVAL_MS) || DEFAULT_INTERVAL_MS } = {}) {
  const run = async () => {
    try {
      const count = await couponService.deactivateExpiredCoupons()
      if (count > 0) console.log(`🎟️  Coupon expiry sweep: deactivated ${count} expired coupon(s)`)
    } catch (err) {
      console.error('[couponExpiryJob] sweep failed:', err.message)
    }
  }

  run()
  const timer = setInterval(run, intervalMs)
  timer.unref?.() // never hold the process open
  return timer
}

module.exports = { startCouponExpiryJob }
