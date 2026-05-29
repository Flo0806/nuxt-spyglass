import { defineBuildConfig } from 'unbuild'

// The module + runtime are built by nuxt-module-builder's preset; this adds the
// standalone MCP server bin (src/mcp/index.ts -> dist/mcp.mjs).
export default defineBuildConfig({
  entries: [
    { input: 'src/mcp/index', name: 'mcp' },
  ],
})
