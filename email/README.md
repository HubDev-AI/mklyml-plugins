# @mklyml/plugins/email

Turns mklyml's web HTML into email-compatible HTML -- CSS inlining, table layout, Outlook support, link tracking.

<p>
  <a href="https://mklyml-docs.hubdev.ai">Documentation</a> &nbsp;&middot;&nbsp;
  <a href="https://mklyml-editor.hubdev.ai">Live Editor</a> &nbsp;&middot;&nbsp;
  <a href="https://github.com/HubDev-AI/mklyml-plugins">GitHub</a>
</p>

---

Email clients don't support `<style>` tags, CSS custom properties, `@layer`, or class selectors. This plugin takes compiled mklyml output and transforms it into a complete email document -- inline styles, table-based layout, Outlook conditional comments.

![Web HTML vs email HTML from the same source](https://raw.githubusercontent.com/HubDev-AI/mklyml-plugins/main/docs/images/email-comparison.png)

![mklyml editor with email preview](https://raw.githubusercontent.com/HubDev-AI/mklyml-plugins/main/docs/images/editor-email.png)

## Usage

```typescript
import { compile, parse, createRegistry, CORE_KIT } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import { emailPlugin } from '@mklyml/plugins/email';

const doc = parse(source);
const result = compile(doc, createRegistry(), {
  kits: { core: CORE_KIT, newsletter: NEWSLETTER_KIT },
  plugins: [emailPlugin()],
});

// result.html -> complete <!DOCTYPE html> email document
// Works in Gmail, Outlook, Apple Mail, Yahoo
```

## What Happens

**CSS inlining.** All `<style>` tags are extracted. `@layer` blocks are unwrapped. CSS custom properties (`--mkly-accent`, etc.) are resolved to concrete values. Each CSS rule is matched to elements by class and written as inline `style` attributes.

**Table wrapping.** Content is wrapped in a centered `<table role="presentation">` with 600px max width. The document gets `<!DOCTYPE>`, charset meta tags, and MSO conditional comments for Outlook.

**Link tracking.** When `variables.trackingPrefix` is set, all `<a href>` URLs are rewritten:
```
https://example.com -> https://track.co/?url=https%3A%2F%2Fexample.com
```

**Cleanup.** `<style>` tags, `<script>` tags, and CSS class attributes are removed. Pseudo-selectors (`:hover`, `::before`) are skipped -- email clients ignore them.

## Before & After

**Input** -- web HTML with scoped CSS:

```html
<style>
@layer theme { .mkly-core-heading { color: var(--mkly-accent); } }
@layer preset { .mkly-core-heading { font-size: 32px; } }
</style>
<h1 class="mkly-core-heading">Hello</h1>
```

**Output** -- email-ready HTML:

```html
<table role="presentation" style="max-width:600px;margin:0 auto">
  <tr><td>
    <h1 style="color:#e2725b;font-size:32px">Hello</h1>
  </td></tr>
</table>
```

No `<style>` tags. No classes. No `var()`. Everything inline.

## Exports

| Export | Purpose |
|--------|---------|
| `emailPlugin()` | The plugin -- add to `compile()` options |
| `cssToInline(html)` | Standalone CSS inliner -- use outside mklyml |
| `emailWrap(content, ctx)` | Table-based document wrapper |
| `emailButton(url, label, ctx)` | VML-compatible button (works in Outlook) |
| `emailColumns(left, right)` | Two-column table layout |
| `trackUrl(url, ctx)` | URL rewriter for link tracking |
| `EMAIL_DEFAULTS` | Default fonts, colors, radius |

## Install

```bash
bun add @mklyml/plugins
```

## Related

- **[mklyml](https://github.com/HubDev-AI/mklyml)** -- Core language
- **[@mklyml/kits/newsletter](https://github.com/HubDev-AI/mklyml-kits)** -- Newsletter blocks, themes, and presets
- **[@mklyml/plugins/docs](https://github.com/HubDev-AI/mklyml-plugins)** -- Docs plugin (heading anchors, copy buttons, tabs)
- **[mklyml-editor](https://github.com/HubDev-AI/mklyml-editor)** -- Visual editor

> **[Full documentation ->](https://mklyml-docs.hubdev.ai)**
