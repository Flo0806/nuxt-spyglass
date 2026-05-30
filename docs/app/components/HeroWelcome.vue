<script setup lang="ts">
const repo = 'https://github.com/Flo0806/nuxt-spyglass'

// A faux correlated feed: browser + server lines sharing one pageLoadId,
// scrolling endlessly to show the core idea - one unified, linked stream.
type Line = { src: 'browser' | 'server', level?: 'error', text: string }
const feed: Line[] = [
  { src: 'browser', text: 'page /dashboard loaded' },
  { src: 'server', text: 'GET /api/stats → 200 · 11ms' },
  { src: 'browser', text: 'fetch /api/stats started' },
  { src: 'server', level: 'error', text: 'ERROR db query timeout' },
  { src: 'browser', level: 'error', text: 'Uncaught: stats undefined' },
  { src: 'server', text: 'GET /api/user → 200 · 4ms' },
  { src: 'browser', text: 'console.warn slow hydration' },
  { src: 'server', text: 'render:html /dashboard · 23ms' },
]
</script>

<template>
  <section
    id="top"
    class="hero"
  >
    <div class="container-wide grid">
      <div class="copy">
        <p class="eyebrow">
          DEV-ONLY NUXT MODULE
        </p>
        <h1>
          Every log in one place -<br>
          and in your <span class="glow">AI's hands</span>.
        </h1>
        <p class="lead">
          <strong>nuxt-spyglass</strong> captures your browser console
          <em>and</em> your Nitro server logs into one correlated stream - then
          hands it to your AI agent over MCP. Stop copy-pasting between terminals
          and tabs. Stop guessing.
        </p>

        <div class="cta">
          <a
            class="btn primary"
            href="#documentation"
          >Get started →</a>
          <a
            class="btn"
            :href="repo"
            target="_blank"
            rel="noopener"
          >View on GitHub</a>
        </div>

        <ul
          class="props"
          role="list"
        >
          <li>🌐🖥️ Browser + server</li>
          <li>🔗 Correlated per request</li>
          <li>🤖 MCP for AI agents</li>
          <li>🚫 Zero-cost in prod</li>
        </ul>
      </div>

      <!-- The showpiece: a live-looking, correlated log feed -->
      <div
        class="scope"
        aria-hidden="true"
      >
        <div class="scope-bar">
          <span class="dot" /><span class="dot" /><span class="dot" />
          <span class="scope-title">spyglass · logs.ndjson</span>
          <span class="live"><span class="live-dot" />live</span>
        </div>
        <div class="viewport">
          <div class="stream">
            <p
              v-for="(line, i) in [...feed, ...feed]"
              :key="i"
              class="line"
              :class="[line.src, { err: line.level === 'error' }]"
            >
              <span class="tag">{{ line.src }}</span>
              <span class="cid">page:a1f</span>
              <span class="msg">{{ line.text }}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  padding-block: var(--space-16) var(--space-12);
  position: relative;
  overflow: hidden;
}

/* faint radial green glow behind the hero */
.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(55% 55% at 50% 0%, var(--accent-soft), transparent 70%);
  pointer-events: none;
}

.grid {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  align-items: center;
  gap: var(--space-12);
}

.copy {
  max-width: 600px;
}

.eyebrow {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  margin-bottom: var(--space-4);
}

.copy h1 {
  font-size: clamp(2rem, 5vw, var(--text-3xl));
  line-height: 1.12;
}

.lead {
  color: var(--muted);
  font-size: var(--text-lg);
  max-width: 52ch;
}

.cta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  color: var(--text);
  font-weight: 600;
  font-size: var(--text-sm);
  transition: transform 0.12s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.btn:hover {
  text-decoration: none;
  text-shadow: none;
  transform: translateY(-1px);
  border-color: var(--accent);
}

.btn.primary {
  background: var(--accent);
  color: #02120c;
  border-color: var(--accent);
  box-shadow: var(--glow);
}

.btn.primary:hover {
  background: var(--accent-dim);
  color: #02120c;
}

.props {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-6);
  margin-top: var(--space-8);
  padding: 0;
  list-style: none;
  color: var(--muted);
  font-size: var(--text-sm);
}

.props li {
  margin: 0;
}

/* ── The scope (animated terminal) ─────────────────────────────────────── */
.scope {
  width: 100%;
  max-width: 640px;
  margin-inline: auto;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow), 0 0 40px rgba(0, 220, 130, 0.08);
  overflow: hidden;
}

.scope-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--border);
}

.scope-title {
  margin-left: var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--muted);
}

/* live-tail indicator, replaces the stray blinking cursor */
.live {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: var(--glow);
  animation: pulse 1.6s ease-in-out infinite;
}

.viewport {
  position: relative;
  height: 280px;
  overflow: hidden;
  padding: var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  -webkit-mask-image: linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent);
  mask-image: linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent);
}

.stream {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  animation: scroll 16s linear infinite;
}

.line {
  margin: 0;
  display: flex;
  gap: var(--space-3);
  white-space: nowrap;
  opacity: 0.92;
}

.tag {
  flex: none;
  min-width: 5.4em;
  text-align: center;
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 0.8em;
  font-weight: 600;
}

.line.browser .tag {
  background: rgba(120, 170, 255, 0.16);
  color: #8fb6ff;
}

.line.server .tag {
  background: var(--accent-soft);
  color: var(--accent);
}

.cid {
  flex: none;
  color: #5a647a;
}

.line.err .msg {
  color: #ff7a7a;
}

@keyframes scroll {
  from {
    transform: translateY(0);
  }
  to {
    /* the feed is duplicated, so -50% loops seamlessly */
    transform: translateY(-50%);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.85);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stream,
  .live-dot {
    animation: none;
  }
}

/* Side by side while there's room; stack and center only when there isn't. */
@media (max-width: 880px) {
  .grid {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
    gap: var(--space-8);
  }
  .copy {
    max-width: 600px;
  }
  .lead {
    margin-inline: auto;
  }
  .cta,
  .props {
    justify-content: center;
  }
}
</style>
