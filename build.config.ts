import { defineBuildConfig } from 'unbuild'

// The module + runtime are built by nuxt-module-builder's preset; this adds the
// standalone bins: the MCP server (src/mcp/index.ts -> dist/mcp.mjs) and the
// human log viewer (src/cli/index.ts -> dist/cli.mjs).
export default defineBuildConfig({
  entries: [
    { input: 'src/mcp/index', name: 'mcp' },
    { input: 'src/cli/index', name: 'cli' },
  ],
})
