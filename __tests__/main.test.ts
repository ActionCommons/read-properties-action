/**
 * © 2026-present Action Commons (https://github.com/ActionCommons)
 *
 * Unit tests for src/main.ts
 *
 * @actions/core is mocked via __fixtures__/core.ts so no real outputs are set.
 * src/properties.ts is mocked via __fixtures__/properties.ts so no real files
 * are read from disk.
 */

import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import * as propertiesMock from '../__fixtures__/properties.js'

// ── Module mocks (must be declared before the module under test is imported) ──
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/properties.js', () => propertiesMock)

// Dynamic import ensures mocks are in place before the module executes.
const { run } = await import('../src/main.js')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Configures core.getInput to return different values by input name. */
function mockInputs(inputs: Record<string, string>): void {
  core.getInput.mockImplementation((name: string) => inputs[name] ?? '')
}

/** Configures parsePropertiesFile to return a fixed record for any path. */
function mockFile(record: Record<string, string>): void {
  propertiesMock.parsePropertiesFile.mockReturnValue(record)
}

/** Collects all calls to core.setOutput as a plain object. */
function capturedOutputs(): Record<string, string> {
  return Object.fromEntries(
    (core.setOutput.mock.calls as [string, string][]).map(([k, v]) => [k, v])
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('run()', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  // ── Validation ────────────────────────────────────────────────────────────
  describe('input validation', () => {
    it('fails when neither file nor files is provided', async () => {
      mockInputs({})
      await run()
      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('"file" or "files"')
      )
      expect(core.setOutput).not.toHaveBeenCalled()
    })
  })

  // ── Single file (`file` input) ────────────────────────────────────────────
  describe('file input', () => {
    it('reads all properties by default and sets outputs as <stem>.<key>', async () => {
      mockInputs({ file: 'config.properties' })
      mockFile({ 'db.host': 'localhost', 'db.port': '5432' })

      await run()

      expect(propertiesMock.parsePropertiesFile).toHaveBeenCalledWith(
        'config.properties'
      )
      expect(capturedOutputs()).toEqual({
        'config.db.host': 'localhost',
        'config.db.port': '5432'
      })
    })

    it('reads only a single property when file-property is set', async () => {
      mockInputs({ file: 'config.properties', 'file-property': 'db.host' })
      mockFile({ 'db.host': 'localhost', 'db.port': '5432' })

      await run()

      expect(capturedOutputs()).toEqual({ 'config.db.host': 'localhost' })
    })

    it('reads only the listed properties when file-properties is set', async () => {
      mockInputs({
        file: 'config.properties',
        'file-properties': 'db.host\ndb.port'
      })
      mockFile({ 'db.host': 'localhost', 'db.port': '5432', 'app.name': 'X' })

      await run()

      const out = capturedOutputs()
      expect(out).toEqual({
        'config.db.host': 'localhost',
        'config.db.port': '5432'
      })
      expect(out['config.app.name']).toBeUndefined()
    })

    it('file-property takes precedence when both filter inputs are set', async () => {
      mockInputs({
        file: 'config.properties',
        'file-property': 'db.host',
        'file-properties': 'db.host\ndb.port'
      })
      mockFile({ 'db.host': 'localhost', 'db.port': '5432' })

      await run()

      // Only the single property should appear.
      expect(capturedOutputs()).toEqual({ 'config.db.host': 'localhost' })
    })

    it('sets no outputs (but does not fail) when the property key does not exist', async () => {
      mockInputs({ file: 'config.properties', 'file-property': 'missing' })
      mockFile({ 'db.host': 'localhost' })

      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(core.setOutput).not.toHaveBeenCalled()
    })
  })

  // ── Multiple files (`files` input) ────────────────────────────────────────
  describe('files input', () => {
    it('reads all files and sets outputs with correct deduplicated stems', async () => {
      mockInputs({
        files: [
          'path/a/config.properties',
          'path/b/config.properties',
          'app.properties'
        ].join('\n')
      })

      // Return different records for each call.
      propertiesMock.parsePropertiesFile
        .mockReturnValueOnce({ host: 'a-host' })
        .mockReturnValueOnce({ host: 'b-host' })
        .mockReturnValueOnce({ name: 'myapp' })

      await run()

      expect(capturedOutputs()).toEqual({
        'config.host': 'a-host',
        'config1.host': 'b-host',
        'app.name': 'myapp'
      })
    })

    it('applies files-property filter to all files', async () => {
      mockInputs({
        files: 'a.properties\nb.properties',
        'files-property': 'host'
      })

      propertiesMock.parsePropertiesFile
        .mockReturnValueOnce({ host: 'alpha', port: '80' })
        .mockReturnValueOnce({ host: 'beta', port: '81' })

      await run()

      expect(capturedOutputs()).toEqual({ 'a.host': 'alpha', 'b.host': 'beta' })
    })

    it('applies files-properties filter to all files', async () => {
      mockInputs({
        files: 'a.properties\nb.properties',
        'files-properties': 'host\nport'
      })

      propertiesMock.parsePropertiesFile
        .mockReturnValueOnce({ host: 'alpha', port: '80', extra: 'x' })
        .mockReturnValueOnce({ host: 'beta', port: '81', extra: 'y' })

      await run()

      const out = capturedOutputs()
      expect(out['a.host']).toBe('alpha')
      expect(out['a.port']).toBe('80')
      expect(out['a.extra']).toBeUndefined()
      expect(out['b.host']).toBe('beta')
      expect(out['b.port']).toBe('81')
    })

    it('ignores blank lines in the files input', async () => {
      mockInputs({ files: '\n  \na.properties\n\nb.properties\n' })

      propertiesMock.parsePropertiesFile
        .mockReturnValueOnce({ x: '1' })
        .mockReturnValueOnce({ x: '2' })

      await run()

      expect(propertiesMock.parsePropertiesFile).toHaveBeenCalledTimes(2)
    })
  })

  // ── Combined `file` + `files` ─────────────────────────────────────────────
  describe('combined file and files inputs', () => {
    it('processes file first then files, deduplicating stems across both', async () => {
      mockInputs({
        file: 'config.properties',
        files: 'config.properties\napp.properties'
      })

      propertiesMock.parsePropertiesFile
        .mockReturnValueOnce({ env: 'dev' }) // file
        .mockReturnValueOnce({ env: 'prod' }) // first in files (same stem)
        .mockReturnValueOnce({ name: 'x' }) // second in files

      await run()

      expect(capturedOutputs()).toEqual({
        'config.env': 'dev',
        'config1.env': 'prod',
        'app.name': 'x'
      })
    })

    it('applies separate filters to file and files independently', async () => {
      mockInputs({
        file: 'config.properties',
        'file-property': 'host',
        files: 'app.properties',
        'files-property': 'name'
      })

      propertiesMock.parsePropertiesFile
        .mockReturnValueOnce({ host: 'localhost', port: '5432' })
        .mockReturnValueOnce({ name: 'myapp', version: '1.0' })

      await run()

      expect(capturedOutputs()).toEqual({
        'config.host': 'localhost',
        'app.name': 'myapp'
      })
    })
  })

  // ── Error handling ────────────────────────────────────────────────────────
  describe('error handling', () => {
    it('calls core.setFailed when parsePropertiesFile throws', async () => {
      mockInputs({ file: 'missing.properties' })
      propertiesMock.parsePropertiesFile.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'ENOENT: no such file or directory'
      )
    })

    it('does not call core.setFailed when a non-Error value is thrown', async () => {
      // Covers the `if (error instanceof Error)` false-branch in the catch block.
      // Throwing a plain string (or any non-Error) means the condition is false
      // and setFailed should never be called.
      mockInputs({ file: 'config.properties' })
      propertiesMock.parsePropertiesFile.mockImplementation(() => {
        throw 'unexpected non-Error rejection'
      })

      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
    })
  })
})
