<template>
  <div>
    <h1>nuxt-spyglass playground</h1>
    <p>Trigger logs, then check <code>.data/spyglass/logs.ndjson</code>.</p>

    <h2>Browser</h2>
    <button @click="() => console.log('hello from the browser')">
      console.log
    </button>
    <button @click="() => console.warn('a warning', { user: 'flo' })">
      console.warn
    </button>
    <button @click="() => console.error('boom', new Error('client error'))">
      console.error
    </button>
    <button @click="() => { throw new Error('uncaught client error') }">
      throw
    </button>

    <h2>Server</h2>
    <button @click="serverLog">
      server log
    </button>
    <button @click="serverThrow">
      server throw
    </button>

    <h2>Correlation ($fetch vs useFetch)</h2>
    <button @click="probeFetch">
      probe via $fetch
    </button>
    <button @click="() => probeUseFetch()">
      probe via useFetch
    </button>

    <h2>evlog (does spyglass catch it?)</h2>
    <button @click="evlogServer">
      evlog server (wide event)
    </button>
    <button @click="() => evlogLog.info('evlog-client', 'hello from evlog client')">
      evlog client info
    </button>
    <button @click="() => evlogLog.error('evlog-client', 'an evlog client error')">
      evlog client error
    </button>
  </div>
</template>

<script setup lang="ts">
const serverLog = () => $fetch('/api/demo/log')
const serverThrow = () => $fetch('/api/demo/throw').catch(() => {})
const evlogServer = () => $fetch('/api/demo/evlog')
// Both hit the same endpoint; the captured server entries show whether the page
// id travelled - $fetch goes through globalThis, useFetch through Nuxt's own
// module-level binding.
const probeFetch = () => $fetch('/api/demo/correlate', { query: { via: 'fetch' } })
const { execute: probeUseFetch } = useFetch('/api/demo/correlate', {
  query: { via: 'useFetch' },
  immediate: false,
  key: 'correlation-probe',
})
// evlog's nuxt module declares `log` as a plain global, not as a component
// property - so alias it here to use it from the template.
const evlogLog = log
</script>
