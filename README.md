# mklyml plugins

Output plugins for [mklyml](https://github.com/HubDev-AI/mklyml) -- transform compiled HTML for different targets.

<p>
  <a href="https://mklyml-docs.hubdev.ai">Documentation</a> &nbsp;&middot;&nbsp;
  <a href="https://mklyml-editor.hubdev.ai">Live Editor</a> &nbsp;&middot;&nbsp;
  <a href="https://github.com/HubDev-AI/mklyml-plugins">GitHub</a>
</p>

---

## Email Plugin

Turns mklyml's web HTML into **email-compatible HTML**. CSS inlining, table-based layout, Outlook conditional comments, link tracking.

![mklyml editor with email preview](https://raw.githubusercontent.com/HubDev-AI/mklyml-plugins/main/docs/images/editor-email.png)

Email clients don't support `<style>` tags, CSS custom properties, or `@layer`. This plugin extracts all CSS, resolves every `var()` reference, inlines every declaration as `style=""` attributes, wraps content in table layout, and strips everything email clients can't handle.

```typescript
import { compile, parse, createRegistry, CORE_KIT } from '@mklyml/core';
import { NEWSLETTER_KIT } from '@mklyml/kits/newsletter';
import { emailPlugin } from '@mklyml/plugins/email';

const doc = parse(source);
const result = compile(doc, createRegistry(), {
  kits: { core: CORE_KIT, newsletter: NEWSLETTER_KIT },
  plugins: [emailPlugin()],
});

// result.html -> complete email document ready for
// Gmail, Outlook, Apple Mail, and Yahoo
```

The output: no `<style>` tags, no CSS classes, no `var()` -- everything inline. Works everywhere.

```bash
bun add @mklyml/plugins
```

> [Full email plugin documentation ->](./email)

---

## Docs Plugin

Post-processing for documentation sites. Heading anchors for deep-linking, copy buttons on code blocks, tab switching, and optional document wrapping with navigation and dark mode.

```typescript
import { DOCS_KIT } from '@mklyml/kits/docs';
import { docsPlugin } from '@mklyml/plugins/docs';

const result = compile(parse(source), createRegistry(), {
  kits: { core: CORE_KIT, docs: DOCS_KIT },
  plugins: [docsPlugin()],
});
```

The [mklyml documentation site](https://mklyml-docs.hubdev.ai) uses this plugin.

```bash
bun add @mklyml/plugins
```

> [Full docs plugin documentation ->](./docs)

---

## Related

- **[mklyml](https://github.com/HubDev-AI/mklyml)** -- Core language
- **[mklyml-editor](https://github.com/HubDev-AI/mklyml-editor)** -- Visual editor with live preview
- **[mklyml-kits](https://github.com/HubDev-AI/mklyml-kits)** -- Newsletter kit (14 blocks, 19 themes, 17 presets) + Docs kit (15 blocks)
- **[mklyml-docs](https://github.com/HubDev-AI/mklyml-docs)** -- Documentation site
