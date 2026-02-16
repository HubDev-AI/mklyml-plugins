# @mklyml/plugins/docs

Post-processing for documentation sites built with [mklyml](https://github.com/HubDev-AI/mklyml) -- heading anchors, copy buttons, tab switching, optional document wrapping.

<p>
  <a href="https://mklyml-docs.hubdev.ai">See it live</a> &nbsp;&middot;&nbsp;
  <a href="https://mklyml-editor.hubdev.ai">Live Editor</a> &nbsp;&middot;&nbsp;
  <a href="https://github.com/HubDev-AI/mklyml-plugins">GitHub</a>
</p>

---

This plugin runs after mklyml compilation and enhances the HTML with interactivity.

The [mklyml documentation site](https://mklyml-docs.hubdev.ai) uses this plugin.

## What It Adds

**Heading anchors** -- Every `core/heading` gets a slug-based `id` and a hover-visible `#` link for deep-linking.

**Code copy buttons** -- Every `docs/codeExample` block gets a "Copy" button. Click it, the code goes to clipboard.

**Tab switching** -- `docs/tabs` containers get JavaScript-powered tab buttons. Click a tab, see its content.

**Document wrapping** (optional) -- Pass `docsPlugin({ wrap: true })` for a full page layout with sticky nav, sidebar, footer, dark mode, and responsive breakpoints.

## Usage

```typescript
import { compile, parse, createRegistry, CORE_KIT } from '@mklyml/core';
import { DOCS_KIT } from '@mklyml/kits/docs';
import { docsPlugin } from '@mklyml/plugins/docs';

const result = compile(parse(source), createRegistry(), {
  kits: { core: CORE_KIT, docs: DOCS_KIT },
  plugins: [docsPlugin()],
});
```

## Exports

| Export | Purpose |
|--------|---------|
| `docsPlugin(options?)` | The plugin |
| `slugify(text)` | URL-safe slug generator |

## Install

```bash
bun add @mklyml/plugins
```

## Related

- **[mklyml](https://github.com/HubDev-AI/mklyml)** -- Core language
- **[@mklyml/kits/docs](https://github.com/HubDev-AI/mklyml-kits)** -- Docs block kit (callouts, code examples, tabs)
- **[@mklyml/plugins/email](https://github.com/HubDev-AI/mklyml-plugins)** -- Email plugin for newsletter output
- **[@mklyml/kits/newsletter](https://github.com/HubDev-AI/mklyml-kits)** -- Newsletter kit (14 blocks, 19 themes, 17 presets)
- **[mklyml-editor](https://github.com/HubDev-AI/mklyml-editor)** -- Visual editor

> **[See the docs site ->](https://mklyml-docs.hubdev.ai)** . **[Try in editor ->](https://mklyml-editor.hubdev.ai)**
