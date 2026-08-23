import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectMcpRegistration } from '../src/shared/mcp-registration'

let home: string
let project: string

const spyglassEntry = { command: 'npx', args: ['-y', '-p', 'nuxt-spyglass', 'nuxt-spyglass-mcp'] }
const otherEntry = { command: 'npx', args: ['-y', 'some-other-mcp'] }

function writeHomeConfig(config: unknown): void {
  writeFileSync(join(home, '.claude.json'), JSON.stringify(config))
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'spyglass-home-'))
  project = mkdtempSync(join(tmpdir(), 'spyglass-project-'))
  mkdirSync(project, { recursive: true })
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
  rmSync(project, { recursive: true, force: true })
})

describe('detectMcpRegistration', () => {
  it('reports user scope for a global registration', () => {
    writeHomeConfig({ mcpServers: { spyglass: spyglassEntry } })
    expect(detectMcpRegistration(project, home)).toBe('user')
  })

  it('reports local scope for a registration bound to this directory', () => {
    writeHomeConfig({ projects: { [project]: { mcpServers: { spyglass: spyglassEntry } } } })
    expect(detectMcpRegistration(project, home)).toBe('local')
  })

  it('reports project scope for a committed .mcp.json', () => {
    writeFileSync(join(project, '.mcp.json'), JSON.stringify({ mcpServers: { spyglass: spyglassEntry } }))
    expect(detectMcpRegistration(project, home)).toBe('project')
  })

  it('recognises a registration that runs the built server directly', () => {
    writeHomeConfig({ mcpServers: { spyglass: { command: 'node', args: ['/opt/nuxt-spyglass/dist/mcp.mjs'] } } })
    expect(detectMcpRegistration(project, home)).toBe('user')
  })

  it('ignores other servers and another project\'s registration', () => {
    writeHomeConfig({
      mcpServers: { other: otherEntry },
      projects: { '/somewhere/else': { mcpServers: { spyglass: spyglassEntry } } },
    })
    expect(detectMcpRegistration(project, home)).toBeNull()
  })

  it('stays quiet when there is no config at all', () => {
    expect(detectMcpRegistration(project, home)).toBeNull()
  })

  it('survives a malformed config', () => {
    writeFileSync(join(home, '.claude.json'), '{ not json')
    expect(detectMcpRegistration(project, home)).toBeNull()
  })
})
