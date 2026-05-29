export default defineEventHandler(() => {
  // Uncaught: Nitro catches and logs this as an error, which Spyglass captures.
  throw new Error('server: boom from /api/demo/throw')
})
