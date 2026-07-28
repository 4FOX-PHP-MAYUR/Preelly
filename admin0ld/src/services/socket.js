/**
 * Real-time socket for the admin app.
 *
 * The Socket.IO connection is a single shared singleton: the reused ChatProvider and
 * CallProvider establish it and register the authenticated user's room (`join-user`),
 * and the admin dashboard listens on that same connection for events such as
 * `new-support-message`. Re-exporting the shared singleton here — rather than opening a
 * second connection — lets admin code import from its own services layer while keeping
 * the connection (and its joined room) unified. A separate instance would silently miss
 * room-scoped server events.
 */
export * from '@shared/services/socket'
export { default } from '@shared/services/socket'
