<script setup lang="ts">
const repo = 'https://github.com/Flo0806/nuxt-spyglass'
const npmx = 'https://npmx.dev/package/nuxt-spyglass'
</script>

<template>
  <header class="header">
    <div class="container-wide inner">
      <a
        class="brand"
        href="#top"
      >
        <AppLogo :size="30" />
        <span class="wordmark">nuxt-<span class="glow">spyglass</span></span>
      </a>

      <nav class="nav">
        <a href="#documentation">Docs</a>
        <a
          class="npmx"
          :href="npmx"
          target="_blank"
          rel="noopener"
        >
          <img
            src="/npmx-mark.svg"
            alt=""
            width="14"
            height="14"
          >
          NPMX
        </a>
        <a
          class="ghost"
          :href="repo"
          target="_blank"
          rel="noopener"
        >GitHub ↗</a>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text);
  font-weight: 650;
}

.brand:hover {
  text-decoration: none;
  text-shadow: none;
}

.wordmark {
  font-size: var(--text-lg);
  letter-spacing: -0.01em;
}

.nav {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  font-size: var(--text-sm);
}

.nav a {
  color: var(--muted);
}

.nav a:hover {
  color: var(--text);
  text-decoration: none;
  text-shadow: none;
}

.nav .npmx {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.nav .npmx img {
  display: block;
}

.nav .ghost {
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-3);
}

.nav .ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@media (max-width: 560px) {
  .nav a:not(.ghost) {
    display: none;
  }
}
</style>
