const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Only trust a client-supplied id if it is a real UUID (avoids HTML/log injection). */
export function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}
