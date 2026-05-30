<script setup lang="ts">
const props = withDefaults(defineProps<{ code: string, label?: string }>(), { label: '' })

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1500)
  }
  catch {
    // Clipboard API unavailable (e.g. non-secure context) - silently ignore.
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="code-block">
    <div class="bar">
      <span class="label">{{ label }}</span>
      <button
        class="copy"
        :class="{ copied }"
        type="button"
        @click="copy"
      >
        {{ copied ? '✓ Copied' : 'Copy' }}
      </button>
    </div>
    <pre><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.code-block {
  margin-block: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--muted);
}

.copy {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--muted);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  transition: color 0.15s ease, border-color 0.15s ease;
}

.copy:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.copy.copied {
  color: var(--accent);
  border-color: var(--accent);
}

.code-block pre {
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}
</style>
