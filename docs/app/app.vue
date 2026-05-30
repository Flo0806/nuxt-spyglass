<script setup lang="ts">
const install = 'npx nuxt module add nuxt-spyglass'
const config = `export default defineNuxtConfig({
  modules: ['nuxt-spyglass'],
})`
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <AppHeader />

    <main>
      <HeroWelcome />

      <section
        id="documentation"
        class="container"
      >
        <h2>Quick start</h2>
        <p>Install it as a dev dependency:</p>
        <CodeBlock
          label="bash"
          :code="install"
        />

        <p>Add it to your Nuxt config - that's the whole setup:</p>
        <CodeBlock
          label="nuxt.config.ts"
          :code="config"
        />

        <p class="muted">
          Start your dev server and logs land in
          <code>.data/spyglass/logs.ndjson</code>. Full docs land here next - the
          <a
            href="https://github.com/Flo0806/nuxt-spyglass#readme"
            target="_blank"
            rel="noopener"
          >README</a>
          has the complete guide in the meantime.
        </p>
      </section>
    </main>

    <AppFooter />
  </div>
</template>
