/**
 * © 2026-present Action Commons (https://github.com/ActionCommons)
 */

import * as core from '@actions/core'
import {
  type FileSpec,
  assignOutputNames,
  filterProperties,
  parsePropertiesFile
} from './properties.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the property filter for a file (or set of files) from the two
 * alternative input forms:
 *
 *  - `property`   → a single key  → filter = [key]
 *  - `properties` → newline-delimited keys → filter = [key, key, ...]
 *  - neither      → `undefined` (= read all, the default)
 *
 * @param property   Value of the `*-property` input.
 * @param properties Value of the `*-properties` input.
 * @returns An array of keys to include, or `undefined` for "all".
 */
function resolveFilter(
  property: string,
  properties: string
): string[] | undefined {
  const trimmed = property.trim()
  if (trimmed) return [trimmed]

  const lines = properties
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  return lines.length > 0 ? lines : undefined
}

/**
 * Parses a newline-delimited multiline input into an array of non-empty paths.
 *
 * @param input Raw value from `core.getInput`.
 * @returns Trimmed, non-empty path strings.
 */
function splitPaths(input: string): string[] {
  return input
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Action entry-point
// ---------------------------------------------------------------------------

/**
 * Main action logic.
 *
 * Reads one or more .properties files and exposes each property as a step
 * output keyed by `<outputName>.<propertyKey>`, where `outputName` is derived
 * from the file's stem (deduplicated with a numeric suffix when two files
 * share the same stem).
 *
 * Input schema
 * ────────────
 * file                 Single .properties file path (required if `files` absent)
 * file-property        Single key to read from `file`      (default: all)
 * file-properties      Newline-separated keys from `file`  (default: all)
 *
 * files                Newline-separated .properties file paths
 * files-property       Single key to read from every file in `files`
 * files-properties     Newline-separated keys from every file in `files`
 *
 * Output schema
 * ─────────────
 * <stem>.<key>  e.g. config.host, config.port
 *
 * When two files share the same stem the second receives a "1" suffix, the
 * third "2", and so on:
 *   config.host   ← first  config.properties
 *   config1.host  ← second config.properties
 *
 * @returns Resolves when all outputs have been set.
 */
export async function run(): Promise<void> {
  try {
    const fileInput = core.getInput('file')
    const filesInput = core.getInput('files')

    // At least one of `file` or `files` must be supplied.
    if (!fileInput.trim() && !filesInput.trim()) {
      core.setFailed('Either the "file" or "files" input must be provided.')
      return
    }

    const specs: FileSpec[] = []

    // ── Single-file input ──────────────────────────────────────────────────
    if (fileInput.trim()) {
      specs.push({
        filePath: fileInput.trim(),
        propertyFilter: resolveFilter(
          core.getInput('file-property'),
          core.getInput('file-properties')
        )
      })
    }

    // ── Multi-file input ───────────────────────────────────────────────────
    if (filesInput.trim()) {
      const filter = resolveFilter(
        core.getInput('files-property'),
        core.getInput('files-properties')
      )
      for (const fp of splitPaths(filesInput)) {
        specs.push({ filePath: fp, propertyFilter: filter })
      }
    }

    // ── Assign deduplicated output-group names ─────────────────────────────
    const outputNames = assignOutputNames(specs.map((s) => s.filePath))

    // ── Parse each file and set outputs ───────────────────────────────────
    for (let i = 0; i < specs.length; i++) {
      const { filePath, propertyFilter } = specs[i]
      const outputName = outputNames[i]

      core.debug(`Processing "${filePath}" → output group "${outputName}"`)

      const allProps = parsePropertiesFile(filePath)
      const props = filterProperties(allProps, propertyFilter)

      const totalCount = Object.keys(allProps).length
      const totalLabel = totalCount === 1 ? 'property' : 'properties'
      core.info(
        `"${outputName}": setting ${Object.keys(props).length} output(s) ` +
          `(${totalCount} ${totalLabel} total)`
      )

      for (const [key, value] of Object.entries(props)) {
        const outputKey = `${outputName}.${key}`
        core.debug(`  ${outputKey}=${value}`)
        core.setOutput(outputKey, value)
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
