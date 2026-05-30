export default defineNuxtConfig({
  modules: ['nuxt-spyglass', 'evlog/nuxt'],
  devtools: { enabled: true },
  compatibilityDate: 'latest',
  // evlog in its DEFAULT setup (no console output) - spyglass still captures it
  // via evlog's drain hook. Add `transport: { enabled: true }` here to also pull
  // in the browser-side evlog logs.
  evlog: { env: { service: 'playground' } },
  spyglass: {},
})
