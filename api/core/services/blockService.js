const mongoose = require('mongoose')
const Follow = require('../../models/Follow')

// Blocks reuse the existing `users-follow` collection (models/Follow.js).
// A block is stored as { follower: blockedUser, following: blocker, status: 'blocked' }
// i.e. "the blocked user may no longer follow the blocker".
// The pair is uniquely indexed, so a mutual block is two records (one per direction),
// and both directions are covered by the { follower, status } / { following, status } indexes.
//
// This module is the single source of truth for reading that relation. Route handlers
// should never query Follow directly for block state.

const BLOCKED = 'blocked'

function toId(value) {
  if (!value) return null
  const raw = value._id ? value._id : value
  const str = String(raw)
  return mongoose.Types.ObjectId.isValid(str) ? str : null
}

function toObjectId(value) {
  const id = toId(value)
  return id ? new mongoose.Types.ObjectId(id) : null
}

/**
 * Every user id that `userId` can no longer see, in either direction:
 * users they blocked and users who blocked them.
 *
 * Returned as ObjectIds so callers can drop them straight into a `$nin` query.
 *
 * @returns {Promise<mongoose.Types.ObjectId[]>}
 */
async function getBlockedUserIds(userId) {
  const me = toObjectId(userId)
  if (!me) return []

  const records = await Follow.find({
    status: BLOCKED,
    $or: [{ following: me }, { follower: me }],
  })
    .select('follower following')
    .lean()

  const meStr = String(me)
  const ids = new Set()
  for (const rec of records) {
    const blocker = String(rec.following)
    const blocked = String(rec.follower)
    // whichever side of the record is not me is the hidden counterparty
    if (blocker === meStr) ids.add(blocked)
    else if (blocked === meStr) ids.add(blocker)
  }

  return Array.from(ids).map((id) => new mongoose.Types.ObjectId(id))
}

/**
 * Mongo filter fragment that excludes blocked users from a query.
 * Returns `{}` for anonymous callers or when nothing is blocked, so it is
 * always safe to spread into an existing query object.
 *
 * @param {string} field - the field holding the owning user id (e.g. 'seller')
 */
async function buildBlockExclusion(userId, field = 'seller') {
  const blockedIds = await getBlockedUserIds(userId)
  if (blockedIds.length === 0) return {}
  return { [field]: { $nin: blockedIds } }
}

/**
 * Block state for each counterparty, relative to `userId`.
 * @returns {Promise<Record<string, {blockedByMe: boolean, blockedMe: boolean}>>}
 */
async function getBlockMap(userId, otherIds) {
  const ids = Array.from(new Set((otherIds || []).map(toId).filter(Boolean)))
  const map = {}
  for (const id of ids) map[id] = { blockedByMe: false, blockedMe: false }

  const me = toId(userId)
  if (!me || ids.length === 0) return map

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id))
  const meObjId = new mongoose.Types.ObjectId(me)

  const records = await Follow.find({
    status: BLOCKED,
    $or: [
      { following: meObjId, follower: { $in: objectIds } }, // I blocked them
      { follower: meObjId, following: { $in: objectIds } }, // they blocked me
    ],
  })
    .select('follower following')
    .lean()

  for (const rec of records) {
    const blocker = String(rec.following)
    const blocked = String(rec.follower)
    if (blocker === me && map[blocked]) map[blocked].blockedByMe = true
    if (blocked === me && map[blocker]) map[blocker].blockedMe = true
  }
  return map
}

/**
 * Block state between two users, relative to `userId`.
 * @returns {Promise<{blockedByMe: boolean, blockedMe: boolean}>}
 */
async function getBlockState(userId, otherId) {
  const other = toId(otherId)
  if (!other) return { blockedByMe: false, blockedMe: false }
  const map = await getBlockMap(userId, [other])
  return map[other] || { blockedByMe: false, blockedMe: false }
}

/**
 * True when a block exists in either direction — the check that gates
 * visibility and interaction. Self-comparison is never blocked.
 */
async function isBlockedBetween(userA, userB) {
  const a = toId(userA)
  const b = toId(userB)
  if (!a || !b || a === b) return false
  const { blockedByMe, blockedMe } = await getBlockState(a, b)
  return blockedByMe || blockedMe
}

/**
 * Filter an in-memory list of documents, dropping any whose `field` points at a
 * blocked user. Use for results that cannot be filtered in the database
 * (aggregations already executed, mixed-source feeds).
 */
async function filterBlockedFromList(userId, items, field = 'seller') {
  if (!Array.isArray(items) || items.length === 0) return items || []
  const blockedIds = await getBlockedUserIds(userId)
  if (blockedIds.length === 0) return items

  const blocked = new Set(blockedIds.map(String))
  return items.filter((item) => {
    if (!item) return false
    const owner = item[field]
    const ownerId = toId(owner && owner._id ? owner._id : owner)
    return !ownerId || !blocked.has(ownerId)
  })
}

module.exports = {
  BLOCKED,
  getBlockedUserIds,
  buildBlockExclusion,
  getBlockMap,
  getBlockState,
  isBlockedBetween,
  filterBlockedFromList,
}
