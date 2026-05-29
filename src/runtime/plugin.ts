import { defineNuxtPlugin } from '#app'

/**
 * Client entry point for Spyglass. Browser log capture is wired up here in a
 * later slice; for now it only establishes the plugin.
 */
export default defineNuxtPlugin(() => {
  // capture hooks land in a later slice
})
