<script setup lang="ts">
const repo = 'https://github.com/Flo0806/nuxt-spyglass'
const npmx = 'https://npmx.dev/package/nuxt-spyglass'
</script>

<template>
  <footer class="footer">
    <div class="container-wide inner">
      <div class="left">
        <AppLogo :size="22" />
        <span>nuxt-<span class="glow">spyglass</span></span>
        <span class="sep">·</span>
        <span class="muted">MIT licensed</span>
      </div>

      <nav class="links">
        <a
          :href="repo"
          target="_blank"
          rel="noopener"
        >GitHub</a>
        <a
          class="npmx"
          :href="npmx"
          target="_blank"
          rel="noopener"
        >
          <img
            src="/npmx-mark.svg"
            alt=""
            width="13"
            height="13"
          >
          NPMX
        </a>
        <a
          href="https://nuxt.com"
          target="_blank"
          rel="noopener"
        >Built for Nuxt</a>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  margin-top: var(--space-16);
  border-top: 1px solid var(--border);
  padding-block: var(--space-8);
}

.inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
  font-size: var(--text-sm);
}

.left {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
}

.sep {
  color: var(--border);
}

.links {
  display: flex;
  gap: var(--space-6);
}

.links a {
  color: var(--muted);
}

.links a:hover {
  color: var(--accent);
  text-decoration: none;
  text-shadow: none;
}

.links .npmx {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.links .npmx img {
  display: block;
}
</style>
