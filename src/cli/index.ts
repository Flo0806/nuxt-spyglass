#!/usr/bin/env node
import { resolve } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import { createScreen, createDraw, createInputManager } from '@jano-editor/ui'
import type { KeyEvent } from '@jano-editor/ui'
import type { LogEntry, LogLevel } from '../runtime/types'
import { readEntries } from '../mcp/queries'

if (!process.stdin.isTTY) {
  process.stderr.write('nuxt-spyglass: needs an interactive terminal (TTY).\n')
  process.exit(1)
}

const logFile = resolve(process.cwd(), process.argv[2] ?? '.data/spyglass/logs.ndjson')

type RGB = [number, number, number]
const ACCENT: RGB = [0, 220, 130]
const TIME: RGB = [110, 115, 125]
const MSG: RGB = [205, 210, 220]
const NOISE: RGB = [95, 100, 110]
const FOOT: RGB = [120, 125, 140]
const LEVEL_FG: Record<LogLevel, RGB> = {
  error: [255, 95, 95],
  warn: [235, 185, 80],
  info: [120, 180, 250],
  log: [200, 205, 215],
  debug: [120, 125, 140],
}
const SOURCE_FG: Record<string, RGB> = {
  browser: [110, 200, 230],
  server: [120, 210, 150],
}

const screen = createScreen()
const draw = createDraw(screen)
const input = createInputManager()

let entries: LogEntry[] = []
let scrollTop = 0
let follow = true
let lastSig = ''

const listHeight = (): number => Math.max(1, screen.height - 2)

function fileSignature(): string {
  const sig = (f: string): string => (existsSync(f) ? `${statSync(f).size}:${statSync(f).mtimeMs}` : '-')
  return `${sig(logFile)}|${sig(`${logFile}.1`)}`
}

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length)
}

function timeOf(ts: number): string {
  const d = new Date(ts)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function render(): void {
  draw.clear()
  const w = screen.width
  const lh = listHeight()
  const total = entries.length
  const maxTop = Math.max(0, total - lh)
  if (follow) {
    scrollTop = maxTop
  }
  scrollTop = Math.max(0, Math.min(scrollTop, maxTop))

  draw.text(0, 0, pad(` 🔭 nuxt-spyglass  ·  ${total} logs  ·  ${logFile}`, w), { fg: ACCENT })

  for (let i = 0; i < lh; i++) {
    const entry = entries[scrollTop + i]
    if (!entry) {
      continue
    }
    const y = 1 + i
    const dim = !!entry.noise
    let x = 0
    draw.text(x, y, timeOf(entry.timestamp), { fg: dim ? NOISE : TIME })
    x += 9
    draw.text(x, y, pad(entry.level.toUpperCase(), 5), { fg: dim ? NOISE : (LEVEL_FG[entry.level] ?? MSG) })
    x += 6
    draw.text(x, y, pad(entry.source, 7), { fg: dim ? NOISE : (SOURCE_FG[entry.source] ?? MSG) })
    x += 8
    const message = (entry.message ?? '').replace(/\s+/g, ' ')
    draw.text(x, y, message.slice(0, Math.max(0, w - x)), { fg: dim ? NOISE : MSG })
  }

  const footer = follow
    ? ' q quit   ↑/↓ scroll   ·   following (newest at bottom)'
    : ` q quit   ↑/↓ scroll   End: jump to newest   ·   ${scrollTop + 1}-${Math.min(scrollTop + lh, total)} / ${total}`
  draw.text(0, screen.height - 1, pad(footer, w), { fg: FOOT })

  draw.flush()
}

function reload(): void {
  entries = readEntries(logFile)
}

function quit(): void {
  input.stop()
  screen.leave()
  process.stdin.setRawMode(false)
  process.exit(0)
}

function scrollBy(delta: number): void {
  const maxTop = Math.max(0, entries.length - listHeight())
  scrollTop = Math.max(0, Math.min(scrollTop + delta, maxTop))
  // Re-engage follow once the user reaches the bottom again.
  follow = scrollTop >= maxTop
  render()
}

process.stdin.setRawMode(true)
process.stdin.resume()
screen.enter()
input.start()

reload()
lastSig = fileSignature()

const layer = input.pushLayer('main')
layer.on('key', (key: KeyEvent) => {
  if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
    quit()
  }
  else if (key.name === 'up') {
    scrollBy(-1)
  }
  else if (key.name === 'down') {
    scrollBy(1)
  }
  else if (key.name === 'pageup') {
    scrollBy(-listHeight())
  }
  else if (key.name === 'pagedown') {
    scrollBy(listHeight())
  }
  else if (key.name === 'home') {
    follow = false
    scrollTop = 0
    render()
  }
  else if (key.name === 'end') {
    follow = true
    render()
  }
  return true
})
layer.on('mouse:scroll', (event) => {
  scrollBy(event.type === 'scroll-up' ? -3 : 3)
  return true
})
layer.on('resize', () => render())

setInterval(() => {
  const sig = fileSignature()
  if (sig !== lastSig) {
    lastSig = sig
    reload()
    render()
  }
}, 400)

render()
