/**
 * CSS Inliner — transforms web HTML + CSS into email-safe inline styles.
 *
 * Takes the compiled web output (HTML with <style> tag) and:
 * 1. Extracts CSS from <style> tags
 * 2. Unwraps @layer blocks
 * 3. Parses CSS rules (selector → declarations)
 * 4. Collects CSS custom properties and resolves var() references
 * 5. Matches selectors to HTML elements by class
 * 6. Inlines styles into style="" attributes
 * 7. Strips <style>, <script>, <meta> tags
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CSSRule {
  selector: string;
  declarations: Map<string, string>;
}

// ---------------------------------------------------------------------------
// 1. Extract CSS from <style> tags
// ---------------------------------------------------------------------------

export function extractStyleContent(html: string): { css: string; htmlWithoutStyle: string } {
  let css = '';
  const htmlWithoutStyle = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, content) => {
    css += content + '\n';
    return '';
  });
  return { css, htmlWithoutStyle };
}

// ---------------------------------------------------------------------------
// 2. Strip non-content tags (scripts, meta)
// ---------------------------------------------------------------------------

export function stripNonContentTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<meta[^>]*>/gi, '');
}

// ---------------------------------------------------------------------------
// 3. Unwrap @layer blocks and @keyframes, skip @media
// ---------------------------------------------------------------------------

/** Find the matching closing brace for an opening brace at `start`. */
function findMatchingBrace(css: string, start: number): number {
  let depth = 1;
  let i = start + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return depth === 0 ? i - 1 : -1;
}

/** Remove an @-block (like @keyframes, @media) by name, handling nested braces. */
function removeAtBlock(css: string, atName: string): string {
  const re = new RegExp(`@${atName}\\b`);
  let result = css;
  let match: RegExpExecArray | null;
  while ((match = re.exec(result)) !== null) {
    const braceStart = result.indexOf('{', match.index);
    if (braceStart === -1) break;
    const braceEnd = findMatchingBrace(result, braceStart);
    if (braceEnd === -1) break;
    result = result.slice(0, match.index) + result.slice(braceEnd + 1);
  }
  return result;
}

/** Strip CSS comments from a string. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

export function unwrapLayers(css: string): string {
  // Strip CSS comments first
  let result = stripComments(css);

  // Remove @layer declaration line (e.g. "@layer kit, theme, preset, user;")
  result = result.replace(/@layer\s+[^;{]+;/g, '');

  // Unwrap @layer blocks: extract inner content using brace counting
  let changed = true;
  while (changed) {
    changed = false;
    const layerMatch = /@layer\s+\w+\s*\{/.exec(result);
    if (!layerMatch) break;

    const braceStart = result.indexOf('{', layerMatch.index);
    if (braceStart === -1) break;

    const braceEnd = findMatchingBrace(result, braceStart);
    if (braceEnd === -1) break;

    const inner = result.slice(braceStart + 1, braceEnd);
    result = result.slice(0, layerMatch.index) + inner + result.slice(braceEnd + 1);
    changed = true;
  }

  // Remove @keyframes blocks (not useful for inline email)
  result = removeAtBlock(result, 'keyframes');

  // Remove @media blocks (email doesn't support them inline)
  result = removeAtBlock(result, 'media');

  return result;
}

// ---------------------------------------------------------------------------
// 4. Parse CSS rules
// ---------------------------------------------------------------------------

export function parseRules(css: string): CSSRule[] {
  const rules: CSSRule[] = [];
  // Match selector { declarations }
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ruleRe.exec(css)) !== null) {
    const rawSelector = match[1].trim();
    const rawDeclarations = match[2].trim();

    if (!rawSelector || !rawDeclarations) continue;

    // Split comma-separated selectors
    const selectors = rawSelector.split(',').map(s => s.trim()).filter(Boolean);

    const declarations = parseDeclarations(rawDeclarations);

    for (const selector of selectors) {
      rules.push({ selector, declarations: new Map(declarations) });
    }
  }

  return rules;
}

function pushDeclaration(raw: string, result: Array<[string, string]>): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx === -1) return;
  const prop = trimmed.slice(0, colonIdx).trim();
  const value = trimmed.slice(colonIdx + 1).trim();
  if (prop && value) {
    result.push([prop, value]);
  }
}

function parseDeclarations(raw: string): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  let current = '';
  let parenDepth = 0;
  for (const ch of raw) {
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === ';' && parenDepth === 0) {
      pushDeclaration(current, result);
      current = '';
    } else {
      current += ch;
    }
  }
  pushDeclaration(current, result);
  return result;
}

// ---------------------------------------------------------------------------
// 5. Collect CSS custom properties and resolve var() references
// ---------------------------------------------------------------------------

export function collectCustomProperties(rules: CSSRule[]): Map<string, string> {
  const vars = new Map<string, string>();

  for (const rule of rules) {
    // Custom properties on :root or .mkly-document
    if (rule.selector === ':root' || rule.selector === '.mkly-document') {
      for (const [prop, val] of rule.declarations) {
        if (prop.startsWith('--')) {
          vars.set(prop, val);
        }
      }
    }
  }

  return vars;
}

export function resolveVarReferences(value: string, vars: Map<string, string>): string {
  let resolved = value;
  let iterations = 0;

  // Resolve nested var() references (up to 10 depth)
  while (resolved.includes('var(') && iterations < 10) {
    iterations++;
    const before = resolved;
    resolved = resolved.replace(/var\(([^()]+)\)/g, (match, expr: string) => {
      const parts = expr.split(',');
      const varName = parts[0].trim();
      const fallback = parts.length > 1 ? parts.slice(1).join(',').trim() : undefined;

      const val = vars.get(varName);
      if (val !== undefined) return val;
      if (fallback !== undefined) return fallback;
      return match;
    });
    if (resolved === before) break;
  }

  return resolved;
}

/** Resolve var() in all variable values first, then resolve in all declarations. */
function resolveAllDeclarations(rules: CSSRule[], vars: Map<string, string>): void {
  // First: resolve var() references within variable values themselves
  // (e.g. --_gs: var(--mkly-gap-scale, 1) → --_gs: 1)
  let changed = true;
  let passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes++;
    for (const [key, val] of vars) {
      if (val.includes('var(')) {
        const resolved = resolveVarReferences(val, vars);
        if (resolved !== val) {
          vars.set(key, resolved);
          changed = true;
        }
      }
    }
  }

  // Then: resolve var() in all rule declarations
  for (const rule of rules) {
    for (const [prop, val] of rule.declarations) {
      if (val.includes('var(')) {
        rule.declarations.set(prop, resolveVarReferences(val, vars));
      }
    }
  }

  // Finally: simplify calc() expressions where possible
  for (const rule of rules) {
    for (const [prop, val] of rule.declarations) {
      if (val.includes('calc(')) {
        rule.declarations.set(prop, simplifyCalc(val));
      }
    }
  }
}

/**
 * Simplify calc() expressions that have been fully resolved.
 * e.g. "calc(40px * 1)" → "40px", "calc(24px * 1.5)" → "36px"
 */
function simplifyCalc(value: string): string {
  return value.replace(/calc\(([^()]+)\)/g, (match, expr: string) => {
    const trimmed = expr.trim();

    // Pattern: <number>px * <number>
    const mulMatch = trimmed.match(/^([\d.]+)px\s*\*\s*([\d.]+)$/);
    if (mulMatch) {
      const result = parseFloat(mulMatch[1]) * parseFloat(mulMatch[2]);
      return `${Math.round(result * 100) / 100}px`;
    }

    // Pattern: <number> * <number>px
    const mulMatch2 = trimmed.match(/^([\d.]+)\s*\*\s*([\d.]+)px$/);
    if (mulMatch2) {
      const result = parseFloat(mulMatch2[1]) * parseFloat(mulMatch2[2]);
      return `${Math.round(result * 100) / 100}px`;
    }

    // If still has unresolved var(), keep as-is
    if (trimmed.includes('var(')) return match;

    return match;
  });
}

// ---------------------------------------------------------------------------
// 6. Selector matching
// ---------------------------------------------------------------------------

/**
 * Check if an element matches a CSS selector.
 * Handles:
 * - .foo (single class)
 * - .foo.bar (compound classes)
 * - .foo .bar (descendant - checked against parents)
 * - .foo p (class parent + tag child — e.g. .mkly-core-cta p)
 * - .foo:hover (pseudo - skipped for email)
 */
function selectorMatchesElement(
  selector: string,
  elementClasses: Set<string>,
  tagName: string,
  parentClassStack: Set<string>[],
  parentTagStack: string[],
): boolean {
  // Skip pseudo-selectors (:hover, :focus, etc.) and pseudo-elements (::marker)
  if (/:[\w-]+/.test(selector.replace(/::[\w-]+/g, ''))) {
    const withoutPseudo = selector.replace(/:[\w-]+(?:\([^)]*\))?/g, '');
    if (withoutPseudo.trim() !== selector.trim()) {
      return false;
    }
  }
  // Also skip selectors containing :: pseudo-elements (::marker, ::before, etc.)
  if (/::[\w-]+/.test(selector)) return false;

  // Split on descendant combinator (space)
  const parts = selector.trim().split(/\s+/);

  if (parts.length === 1) {
    return partMatchesElement(parts[0], elementClasses, tagName);
  }

  if (parts.length === 2) {
    const childPart = parts[1];
    const parentPart = parts[0];

    if (!partMatchesElement(childPart, elementClasses, tagName)) return false;

    for (let i = 0; i < parentClassStack.length; i++) {
      if (partMatchesElement(parentPart, parentClassStack[i], parentTagStack[i])) return true;
    }
    return false;
  }

  // Deeper nesting — check last part against element, walk ancestors for earlier parts
  const lastPart = parts[parts.length - 1];
  if (!partMatchesElement(lastPart, elementClasses, tagName)) return false;

  // For the remaining parts, walk up the ancestor chain
  let partIdx = parts.length - 2;
  for (let i = parentClassStack.length - 1; i >= 0 && partIdx >= 0; i--) {
    if (partMatchesElement(parts[partIdx], parentClassStack[i], parentTagStack[i])) {
      partIdx--;
    }
  }
  return partIdx < 0;
}

/**
 * Check if a selector part matches an element by tag name AND/OR classes.
 * Supports: tag, .class, tag.class, .class1.class2
 */
function partMatchesElement(part: string, classes: Set<string>, tagName: string): boolean {
  // Remove pseudo-selectors and pseudo-elements
  const withoutPseudo = part.replace(/:[\w-]+(?:\([^)]*\))?/g, '').replace(/::[\w-]+/g, '');
  if (!withoutPseudo || withoutPseudo !== part) return false;

  // Check if part starts with a tag name (no leading dot)
  const firstDot = withoutPseudo.indexOf('.');
  const hasTag = firstDot !== 0 && /^[a-zA-Z]/.test(withoutPseudo);
  const tagPart = hasTag ? (firstDot > 0 ? withoutPseudo.slice(0, firstDot) : withoutPseudo) : null;

  // If tag is specified, it must match
  if (tagPart && tagPart.toLowerCase() !== tagName.toLowerCase()) return false;

  // Extract class names
  const classNames: string[] = [];
  const classRe = /\.([\w-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(withoutPseudo)) !== null) {
    classNames.push(m[1]);
  }

  // Pure tag selector (no classes) — tag match already confirmed above
  if (classNames.length === 0) return tagPart !== null;

  // All classes must be present
  return classNames.every(c => classes.has(c));
}

// ---------------------------------------------------------------------------
// 7. Inline styles into HTML
// ---------------------------------------------------------------------------

/**
 * Walk through HTML, match CSS rules to elements (by class AND tag name),
 * and inline the computed styles.
 */
export function inlineStyles(html: string, rules: CSSRule[]): string {
  // Filter out rules that only target :root or .mkly-document variables
  const styleRules = rules.filter(r => {
    if (r.selector === ':root' || r.selector === '.mkly-document') {
      // Keep only if it has non-custom-property declarations
      for (const [prop] of r.declarations) {
        if (!prop.startsWith('--')) return true;
      }
      return false;
    }
    return true;
  });

  // Track parent class + tag stacks for descendant selectors
  const parentClassStack: Set<string>[] = [];
  const parentTagStack: string[] = [];

  // Process HTML element by element
  const result: string[] = [];
  let lastIdx = 0;

  const tagRe = /<(\/)?(\w+)([^>]*?)(\/?)\s*>/g;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = tagRe.exec(html)) !== null) {
    const isClosing = !!tagMatch[1];
    const tagName = tagMatch[2];
    const attrs = tagMatch[3];
    const selfClosing = !!tagMatch[4] || ['img', 'br', 'hr', 'meta', 'link', 'input'].includes(tagName);

    // Append text before this tag
    result.push(html.slice(lastIdx, tagMatch.index));

    if (isClosing) {
      if (parentTagStack.length > 0 && parentTagStack[parentTagStack.length - 1] === tagName) {
        parentTagStack.pop();
        parentClassStack.pop();
      }
      result.push(tagMatch[0]);
      lastIdx = tagMatch.index + tagMatch[0].length;
      continue;
    }

    // Extract classes from this element
    const classMatch = attrs.match(/\bclass="([^"]*)"/);
    const elementClasses = new Set<string>(
      classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : [],
    );

    // Find matching rules (by class AND/OR tag)
    const inlineDeclarations = new Map<string, string>();
    for (const rule of styleRules) {
      if (selectorMatchesElement(rule.selector, elementClasses, tagName, parentClassStack, parentTagStack)) {
        for (const [prop, val] of rule.declarations) {
          if (!prop.startsWith('--')) {
            inlineDeclarations.set(prop, val);
          }
        }
      }
    }

    if (inlineDeclarations.size > 0 || elementClasses.size > 0) {
      // Merge with existing inline style
      const existingStyleMatch = attrs.match(/\bstyle="([^"]*)"/);
      const existingStyle = existingStyleMatch ? existingStyleMatch[1] : '';

      const mergedStyles = new Map<string, string>();
      if (existingStyle) {
        for (const [prop, val] of parseDeclarations(existingStyle)) {
          mergedStyles.set(prop, val);
        }
      }

      // CSS rules go first, then existing inline style overrides
      const finalStyles = new Map<string, string>();
      for (const [prop, val] of inlineDeclarations) {
        finalStyles.set(prop, val);
      }
      for (const [prop, val] of mergedStyles) {
        finalStyles.set(prop, val);
      }

      // Remove class attr, merge styles
      let newAttrs = attrs
        .replace(/\bclass="[^"]*"/, '')
        .replace(/\bstyle="[^"]*"/, '')
        .trim();

      if (finalStyles.size > 0) {
        const styleStr = [...finalStyles.entries()]
          .map(([k, v]) => `${k}:${v}`)
          .join(';');
        newAttrs = newAttrs ? ` ${newAttrs} style="${styleStr}"` : ` style="${styleStr}"`;
      } else {
        newAttrs = newAttrs ? ` ${newAttrs}` : '';
      }
      result.push(`<${tagName}${newAttrs}${selfClosing ? ' /' : ''}>`);
    } else {
      result.push(tagMatch[0]);
    }

    // Push to stacks for descendant tracking
    if (!selfClosing && !isClosing) {
      parentTagStack.push(tagName);
      parentClassStack.push(elementClasses);
    }

    lastIdx = tagMatch.index + tagMatch[0].length;
  }

  // Append remaining text
  result.push(html.slice(lastIdx));

  return result.join('');
}

// ---------------------------------------------------------------------------
// 8. Extract <main> content
// ---------------------------------------------------------------------------

export function extractMainContent(html: string): string {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return mainMatch ? mainMatch[1] : html;
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

export function cssToInline(webHtml: string): { contentHtml: string; documentStyles: Map<string, string> } {
  // 1. Extract CSS
  const { css, htmlWithoutStyle } = extractStyleContent(webHtml);

  // 2. Strip scripts/meta
  const cleanHtml = stripNonContentTags(htmlWithoutStyle);

  // 3. Unwrap @layer
  const flatCss = unwrapLayers(css);

  // 4. Parse rules
  const rules = parseRules(flatCss);

  // 5. Collect and resolve CSS variables
  const vars = collectCustomProperties(rules);
  resolveAllDeclarations(rules, vars);

  // 6. Collect document-level styles (from .mkly-document rules, exact match only)
  const documentStyles = new Map<string, string>();
  for (const rule of rules) {
    if (rule.selector.trim() === '.mkly-document') {
      for (const [prop, val] of rule.declarations) {
        if (!prop.startsWith('--')) {
          documentStyles.set(prop, val);
        }
      }
    }
  }

  // 7. Inline styles (before extracting <main> so .mkly-document selectors match)
  const inlined = inlineStyles(cleanHtml, rules);

  // 8. Extract main content (after inlining so descendant selectors resolved)
  const contentHtml = extractMainContent(inlined);

  return { contentHtml, documentStyles };
}
