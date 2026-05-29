#!/usr/bin/env node
import { resolve } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import { createScreen, createDraw, createInputManager, showSearch } from '@jano-editor/ui'
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
const SEL_BG: RGB = [40, 60, 95]
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
let searchOpen = false
let selectedLine: number | null = null
let blinkOn = true

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
    const idx = scrollTop + i
    const entry = entries[idx]
    if (!entry) {
      continue
    }
    const y = 1 + i
    const dim = !!entry.noise
    const highlighted = idx === selectedLine && blinkOn
    const bg = highlighted ? SEL_BG : undefined
    if (highlighted) {
      draw.text(0, y, ' '.repeat(w), { bg: SEL_BG })
    }
    let x = 0
    draw.text(x, y, timeOf(entry.timestamp), { fg: dim ? NOISE : TIME, bg })
    x += 9
    draw.text(x, y, pad(entry.level.toUpperCase(), 5), { fg: dim ? NOISE : (LEVEL_FG[entry.level] ?? MSG), bg })
    x += 6
    draw.text(x, y, pad(entry.source, 7), { fg: dim ? NOISE : (SOURCE_FG[entry.source] ?? MSG), bg })
    x += 8
    const message = (entry.message ?? '').replace(/\s+/g, ' ')
    draw.text(x, y, message.slice(0, Math.max(0, w - x)), { fg: dim ? NOISE : MSG, bg })
  }

  const footer = follow
    ? ' q quit   ↑/↓ scroll   / search   ·   following (newest at bottom)'
    : ` q quit   ↑/↓ scroll   / search   End: newest   ·   ${scrollTop + 1}-${Math.min(scrollTop + lh, total)} / ${total}`
  draw.text(0, screen.height - 1, pad(footer, w), { fg: FOOT })

  draw.flush()
}

function reload(): void {
  entries = readEntries(logFile)
}

/** Briefly blink a row to draw the eye, then leave it highlighted. */
function flashLine(line: number): void {
  selectedLine = line
  follow = false
  const maxTop = Math.max(0, entries.length - listHeight())
  scrollTop = Math.max(0, Math.min(line - Math.floor(listHeight() / 2), maxTop))
  blinkOn = true
  let toggles = 0
  const timer = setInterval(() => {
    blinkOn = !blinkOn
    render()
    if (++toggles >= 6) {
      clearInterval(timer)
      selectedLine = null
      render()
    }
  }, 200)
}

/** Open the library's search overlay over the current logs and jump to a hit. */
async function openSearch(): Promise<void> {
  searchOpen = true
  const lines = entries.map(e => `${timeOf(e.timestamp)} ${e.level} ${e.source} ${(e.message ?? '').replace(/\s+/g, ' ')}`)
  try {
    const result = await showSearch(input, screen, draw, lines, { searchOnly: true }, render)
    if (result.type === 'jump') {
      flashLine(result.match.line)
    }
  }
  finally {
    searchOpen = false
    render()
  }
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
  else if (key.name === '/' || (key.ctrl && key.name === 'f')) {
    void openSearch()
  }
  return true
})
layer.on('mouse:scroll', (event) => {
  scrollBy(event.type === 'scroll-up' ? -3 : 3)
  return true
})
layer.on('resize', () => render())

setInterval(() => {
  if (searchOpen) {
    return
  }
  const sig = fileSignature()
  if (sig !== lastSig) {
    lastSig = sig
    reload()
    render()
  }
}, 400)

render()
