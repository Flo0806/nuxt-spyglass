<script setup lang="ts">
defineProps<{ id: string, title: string, kicker?: string }>()
</script>

<template>
  <section
    :id="id"
    class="doc-section"
  >
    <a
      class="anchor"
      :href="`#${id}`"
      aria-hidden="true"
    >#</a>
    <p
      v-if="kicker"
      class="kicker"
    >
      {{ kicker }}
    </p>
    <h2>{{ title }}</h2>
    <slot />
  </section>
</template>

<style scoped>
.doc-section {
  position: relative;
  scroll-margin-top: 80px;
  padding-block: var(--space-8);
  border-top: 1px solid var(--border);
}

.doc-section :deep(h2) {
  margin-top: 0;
}

.kicker {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: var(--space-2);
}

/* hover-reveal section anchor, classic docs touch */
.anchor {
  position: absolute;
  left: -1.2em;
  top: calc(var(--space-8) + 0.1em);
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.doc-section:hover .anchor {
  opacity: 0.5;
}

.anchor:hover {
  opacity: 1 !important;
  text-decoration: none;
  text-shadow: none;
}

@media (max-width: 720px) {
  .anchor {
    display: none;
  }
}
</style>
