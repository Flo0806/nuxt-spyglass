<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 32 })
</script>

<template>
  <img
    class="logo"
    src="/spyglass.svg"
    :width="size"
    :height="size"
    alt=""
    aria-hidden="true"
  >
</template>

<style scoped>
.logo {
  filter: drop-shadow(0 0 6px rgba(0, 220, 130, 0.45));
}
</style>
