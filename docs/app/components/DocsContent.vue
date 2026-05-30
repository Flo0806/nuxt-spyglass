<script setup lang="ts">
const features = [
  { icon: '🌐🖥️', title: 'Browser + server', text: 'Unified browser and server logs in a single NDJSON file.' },
  { icon: '🔗', title: 'Correlated', text: 'Linked across the boundary via pageLoadId (per page load) and requestId (per request).' },
  { icon: '💥', title: 'Real stack traces', text: 'Captures console.*, uncaught errors, unhandled rejections and server throws.' },
  { icon: '🤖', title: 'MCP built in', text: 'A stdio MCP server so AI agents can query your logs directly.' },
  { icon: '👀', title: 'Terminal viewer', text: 'Built-in live log viewer for humans - tail, colors, search.' },
  { icon: '🚫', title: 'Dev-only', text: 'A verified no-op in production. Zero code, zero cost in your build.' },
]

const toc = [
  { id: 'install', label: 'Install' },
  { id: 'config', label: 'Configuration' },
  { id: 'how', label: 'How it works' },
  { id: 'cli', label: 'CLI viewer' },
  { id: 'mcp', label: 'AI access (MCP)' },
  { id: 'evlog', label: 'evlog' },
]

const tools = [
  { name: 'recent_errors', desc: 'The most recent errors, browser and server.' },
  { name: 'recent_logs', desc: 'Recent logs, optionally filtered by level, source or start time.' },
  { name: 'logs_for_page', desc: 'Every log of one page load by pageLoadId - the full correlated tree.' },
  { name: 'search', desc: 'Case-insensitive substring search across messages.' },
  { name: 'logs_since_last_check', desc: 'Only what arrived since the previous call - see what changed after an action.' },
]

const installNpx = 'npx nuxt module add nuxt-spyglass'
const installPnpm = 'pnpm add -D nuxt-spyglass'
const configMin = `export default defineNuxtConfig({
  modules: ['nuxt-spyglass'],
})`
const configFull = `export default defineNuxtConfig({
  modules: ['nuxt-spyglass'],

  spyglass: {
    // Master switch. Always off in production builds, regardless of this value.
    enabled: true,
    // NDJSON log file; relative paths resolve against the project root.
    logFile: '.data/spyglass/logs.ndjson',
    // Rotate once the active file reaches this size (keeps at most two files).
    maxFileSize: 5 * 1024 * 1024,
  },
})`
const cliUsage = `npx nuxt-spyglass                  # uses .data/spyglass/logs.ndjson
npx nuxt-spyglass <path-to-logs>   # or point it at the file explicitly`
const evlogConfig = `export default defineNuxtConfig({
  modules: ['nuxt-spyglass', 'evlog/nuxt'],
  // Browser-side evlog logs are captured too once transport is on.
  evlog: { transport: { enabled: true } },
})`

type Agent = 'claude' | 'codex' | 'copilot'
const agent = ref<Agent>('claude')
const agents: { id: Agent, label: string, fileLabel: string, code: string }[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    fileLabel: 'terminal',
    code: `claude mcp add --transport stdio spyglass -- \\
  npx -p nuxt-spyglass nuxt-spyglass-mcp /abs/path/to/your-app/.data/spyglass/logs.ndjson`,
  },
  {
    id: 'codex',
    label: 'Codex',
    fileLabel: '~/.codex/config.toml',
    code: `[mcp_servers.spyglass]
command = "npx"
args = ["-p", "nuxt-spyglass", "nuxt-spyglass-mcp", "/abs/path/to/your-app/.data/spyglass/logs.ndjson"]`,
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    fileLabel: '.vscode/mcp.json',
    code: `{
  "servers": {
    "spyglass": {
      "type": "stdio",
      "command": "npx",
      "args": ["-p", "nuxt-spyglass", "nuxt-spyglass-mcp", "/abs/path/to/your-app/.data/spyglass/logs.ndjson"]
    }
  }
}`,
  },
]
const activeAgent = computed(() => agents.find(a => a.id === agent.value)!)
</script>

<template>
  <div
    id="documentation"
    class="container docs"
  >
    <!-- Features -->
    <section class="features-block">
      <p class="kicker">
        WHY SPYGLASS
      </p>
      <h2>Everything, in one correlated place</h2>
      <div class="features">
        <div
          v-for="f in features"
          :key="f.title"
          class="feature surface"
        >
          <span class="f-icon">{{ f.icon }}</span>
          <h3>{{ f.title }}</h3>
          <p class="muted">
            {{ f.text }}
          </p>
        </div>
      </div>
    </section>

    <!-- on-page nav -->
    <nav class="toc">
      <a
        v-for="t in toc"
        :key="t.id"
        :href="`#${t.id}`"
      >{{ t.label }}</a>
    </nav>

    <DocSection
      id="install"
      kicker="Quick start"
      title="Install in two steps"
    >
      <p>Install it as a dev dependency:</p>
      <CodeBlock
        label="bash"
        :code="installNpx"
      />
      <CodeBlock
        label="bash · alternative"
        :code="installPnpm"
      />
      <p>Add it to your Nuxt config - that's the whole setup:</p>
      <CodeBlock
        label="nuxt.config.ts"
        :code="configMin"
      />
      <p class="muted">
        Start your dev server and logs land in
        <code>.data/spyglass/logs.ndjson</code> (already covered by the default
        <code>.gitignore</code>).
      </p>
    </DocSection>

    <DocSection
      id="config"
      kicker="Configuration"
      title="Options"
    >
      <CodeBlock
        label="nuxt.config.ts"
        :code="configFull"
      />
      <table>
        <thead>
          <tr><th>Option</th><th>Default</th><th>What it does</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>enabled</code></td>
            <td><code>true</code></td>
            <td>Master switch. Always off in production builds, regardless of this value.</td>
          </tr>
          <tr>
            <td><code>logFile</code></td>
            <td><code>.data/spyglass/logs.ndjson</code></td>
            <td>NDJSON log file. Relative paths resolve against the project root.</td>
          </tr>
          <tr>
            <td><code>maxFileSize</code></td>
            <td><code>5&nbsp;MB</code></td>
            <td>Rotate once the active file reaches this size. Keeps at most two files.</td>
          </tr>
        </tbody>
      </table>
    </DocSection>

    <DocSection
      id="how"
      kicker="Under the hood"
      title="How it works"
    >
      <ul>
        <li><strong>Browser:</strong> a client plugin wraps <code>console.*</code> and listens for <code>error</code> / <code>unhandledrejection</code>, buffers entries and ships them to a Nitro endpoint.</li>
        <li><strong>Server:</strong> a consola reporter plus a Nitro <code>error</code> hook capture server logs and unhandled errors - with their original stack.</li>
        <li>Everything lands in one <strong>NDJSON</strong> file through a single write queue.</li>
        <li><strong>Correlation:</strong> each page load carries a <code>pageLoadId</code> (injected during SSR, sent back to the server on same-origin requests); each request gets its own <code>requestId</code>. Browser and server entries of the same page load therefore share one id.</li>
      </ul>
    </DocSection>

    <DocSection
      id="cli"
      kicker="For humans"
      title="Live log viewer (CLI)"
    >
      <p>A built-in terminal viewer - run it in a second terminal next to your dev server:</p>
      <CodeBlock
        label="bash"
        :code="cliUsage"
      />
      <ul>
        <li>Live tail, newest at the bottom, auto-follows; scroll with <kbd>↑</kbd>/<kbd>↓</kbd>, <kbd>PageUp</kbd>/<kbd>PageDown</kbd>, <kbd>Home</kbd>/<kbd>End</kbd>, or the mouse wheel.</li>
        <li>Browser + server logs interleaved, colored by level, framework noise dimmed.</li>
        <li><kbd>/</kbd> to search - jump to a hit, which briefly highlights. <kbd>q</kbd> or <kbd>Ctrl</kbd>+<kbd>C</kbd> to quit.</li>
      </ul>
      <blockquote>
        On dev startup the module prints the exact command with the resolved path - just copy-paste it.
      </blockquote>
    </DocSection>

    <DocSection
      id="mcp"
      kicker="For your AI"
      title="AI access (MCP)"
    >
      <p>
        Spyglass ships <code>nuxt-spyglass-mcp</code>, a lightweight stdio MCP
        server that reads your log file and exposes it to AI agents.
      </p>
      <ul>
        <li>Your AI agent <strong>launches the server itself</strong> - you never run it manually.</li>
        <li>Keep your <strong>Nuxt dev server running</strong>; the MCP server only reads the file on demand.</li>
        <li>After registering, <strong>start a new agent session</strong> so the tools load.</li>
      </ul>

      <h3>Tools</h3>
      <table>
        <thead>
          <tr><th>Tool</th><th>What it returns</th></tr>
        </thead>
        <tbody>
          <tr
            v-for="t in tools"
            :key="t.name"
          >
            <td><code>{{ t.name }}</code></td>
            <td>{{ t.desc }}</td>
          </tr>
        </tbody>
      </table>
      <p class="muted">
        Framework noise (Vue warnings, devtools, build lifecycle) is excluded by
        default; pass <code>includeNoise: true</code> to any tool to see everything.
      </p>

      <h3>Set up your agent</h3>
      <div class="tabs">
        <button
          v-for="a in agents"
          :key="a.id"
          type="button"
          class="tab"
          :class="{ active: agent === a.id }"
          @click="agent = a.id"
        >
          {{ a.label }}
        </button>
      </div>
      <CodeBlock
        :label="activeAgent.fileLabel"
        :code="activeAgent.code"
      />
      <p class="muted">
        Easiest of all: copy the fully-resolved command straight from the dev
        startup log.
      </p>
    </DocSection>

    <DocSection
      id="evlog"
      kicker="Integration"
      title="Works with evlog"
    >
      <p>
        Using <a
          href="https://evlog.dev"
          target="_blank"
          rel="noopener"
        >evlog</a> for structured logging? Spyglass captures it automatically via
        evlog's <code>evlog:drain</code> hook - reading the structured event
        directly, so it works even with evlog's console-less default. Per-request
        logs become individual entries; the wide event becomes a request summary
        with its fields and error stack, correlated like everything else.
      </p>
      <p>Enable evlog's transport to pull in browser-side evlog logs too:</p>
      <CodeBlock
        label="nuxt.config.ts"
        :code="evlogConfig"
      />
    </DocSection>
  </div>
</template>

<style scoped>
.docs {
  /* a touch wider than the default reading container, still comfortable */
  max-width: 920px;
  margin-inline: auto;
  padding-block: var(--space-12);
}

/* ── Features grid ─────────────────────────────────────────────────────── */
.features-block .kicker {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  margin-bottom: var(--space-2);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-6);
}

.feature {
  padding: var(--space-6);
}

.feature h3 {
  margin-top: var(--space-3);
  font-size: var(--text-lg);
}

.feature p {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
}

.f-icon {
  font-size: 1.5rem;
}

/* ── On-page nav ───────────────────────────────────────────────────────── */
.toc {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-12);
  margin-bottom: var(--space-6);
}

.toc a {
  color: var(--muted);
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--border);
  border-radius: 999px;
}

.toc a:hover {
  color: var(--accent);
  border-color: var(--accent);
  text-decoration: none;
  text-shadow: none;
}

/* ── MCP agent tabs ────────────────────────────────────────────────────── */
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-4);
  margin-bottom: var(--space-3);
}

.tab {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--muted);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.tab:hover {
  color: var(--text);
}

.tab.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}
</style>
