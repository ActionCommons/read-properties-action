# read-properties-action

![CI](../../../actions/workflows/ci.yml/badge.svg)
![Check dist/](../../../actions/workflows/check-dist.yml/badge.svg)
![CodeQL](../../../actions/workflows/codeql-analysis.yml/badge.svg)
![Coverage](../badges/coverage.svg)

A GitHub Action that reads one or more Java-style `.properties` files and
exposes every key-value pair as a step output.

## Usage

### Read a single file (all properties)

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v6

  - name: Read config
    id: props
    uses: ActionCommons/read-properties-action@v1
    with:
      file: config/app.properties

  - name: Use a value
    run: echo "${{ steps.props.outputs['app.version'] }}"
```

### Read a single property from a file

```yaml
- name: Read one property
  id: props
  uses: ActionCommons/read-properties-action@v1
  with:
    file: config/app.properties
    file-property: app.version
```

### Read a subset of properties from a file

```yaml
- name: Read selected properties
  id: props
  uses: ActionCommons/read-properties-action@v1
  with:
    file: config/app.properties
    file-properties: |
      app.version
      app.name
```

### Read multiple files

```yaml
- name: Read multiple files
  id: props
  uses: ActionCommons/read-properties-action@v1
  with:
    files: |
      config/database.properties
      config/app.properties
```

### Read a subset of properties from multiple files

```yaml
- name: Read host from all configs
  id: props
  uses: ActionCommons/read-properties-action@v1
  with:
    files: |
      config/database.properties
      config/cache.properties
    files-property: host
```

### Mix `file` and `files` with independent filters

```yaml
- name: Read with mixed inputs
  id: props
  uses: ActionCommons/read-properties-action@v1
  with:
    file: config/database.properties
    file-property: db.host
    files: |
      config/app.properties
      config/feature-flags.properties
    files-properties: |
      app.name
      app.version
```

## Inputs

At least one of `file` or `files` must be provided. Both can be used together.

### Single-file inputs

| Input             | Required          | Description                                        |
| ----------------- | ----------------- | -------------------------------------------------- |
| `file`            | if `files` absent | Path to a single `.properties` file                |
| `file-property`   | No                | Read only this one key from `file`                 |
| `file-properties` | No                | Newline-separated list of keys to read from `file` |

When neither `file-property` nor `file-properties` is set, all properties are
read (the default `all` behaviour). `file-property` takes precedence if both are
set.

### Multi-file inputs

| Input              | Required         | Description                                                       |
| ------------------ | ---------------- | ----------------------------------------------------------------- |
| `files`            | if `file` absent | Newline-separated list of `.properties` file paths                |
| `files-property`   | No               | Read only this one key from every file in `files`                 |
| `files-properties` | No               | Newline-separated list of keys to read from every file in `files` |

The `files-property`/`files-properties` filter applies uniformly to every file
listed in `files`. To use a different filter per file, list each file separately
using `file` and multiple workflow steps instead.

## Outputs

Outputs are set dynamically at runtime as `<stem>.<property-key>`, where `stem`
is the filename without its extension.

| Example file        | Example property | Output key       |
| ------------------- | ---------------- | ---------------- |
| `config.properties` | `db.host`        | `config.db.host` |
| `app.properties`    | `version`        | `app.version`    |

### Referencing outputs in expressions

Because output keys contain dots, use bracket notation:

```yaml
${{ steps.props.outputs['config.db.host'] }}
```

### Duplicate filenames

When two files share the same name (but live in different directories), the
first keeps the plain stem and each subsequent file receives a 1-based numeric
suffix:

| File                            | Stem assigned |
| ------------------------------- | ------------- |
| `env/prod/config.properties`    | `config`      |
| `env/staging/config.properties` | `config1`     |
| `env/dev/config.properties`     | `config2`     |

## Supported `.properties` syntax

| Feature                        | Supported |
| ------------------------------ | :-------: |
| `key=value` assignment         |    ✅     |
| `key: value` (colon separator) |    ✅     |
| `#` and `!` comment lines      |    ✅     |
| Backslash line continuation    |    ✅     |
| Spaces around the separator    |    ✅     |
| `=` signs inside values        |    ✅     |
| Empty values (`key=`)          |    ✅     |
| Windows CRLF line endings      |    ✅     |

## Testing locally

Copy `.env.example` to `.env` and set your input values, then run:

```bash
npx @github/local-action . src/main.ts .env
```

Input names follow the `INPUT_<NAME>` convention (hyphens are **not** converted
to underscores):

```bash
# .env
ACTIONS_STEP_DEBUG=true
INPUT_FILE=config/app.properties
INPUT_FILE-PROPERTY=app.version
```
