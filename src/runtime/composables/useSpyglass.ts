import { useRuntimeConfig } from '#imports'

interface SpyglassState {
  /** Whether capture is active in the current environment. */
  enabled: boolean
}

/**
 * Access Spyglass' runtime state from anywhere in the app. For now this only
 * reports whether capture is active; the capture API lands in a later slice.
 */
export function useSpyglass(): SpyglassState {
  const config = useRuntimeConfig().public.spyglass as SpyglassState | undefined
  return {
    enabled: config?.enabled ?? false,
  }
}
