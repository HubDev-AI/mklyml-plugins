import type { MklyBlock, CompileContext, CompileResult } from '@mklyml/core';
import { definePlugin, escapeHtml, prop } from '@mklyml/core';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function clampInt(value: string | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined) return fallback;
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function headingWithAnchor(block: MklyBlock, _ctx: CompileContext): string {
  const level = clampInt(prop(block, 'level'), 1, 6, 2);
  const tag = `h${level}`;
  const text = block.content || prop(block, 'text') || '';
  const slug = slugify(text);
  const id = slug ? ` id="${escapeHtml(slug)}"` : '';
  const anchor = slug
    ? `<a href="#${escapeHtml(slug)}" class="mkly-docs-heading__anchor">#</a>`
    : '';
  return `<${tag}${id} class="mkly-core-heading mkly-core-heading--${level} mkly-docs-heading">${anchor}${escapeHtml(text)}</${tag}>`;
}

function codeWithCopyButton(block: MklyBlock, _ctx: CompileContext): string {
  const lang = prop(block, 'lang');
  const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
  return `<div class="mkly-core-code mkly-docs-code"><button class="mkly-docs-code__copy" aria-label="Copy code">Copy</button><pre><code${langAttr}>${escapeHtml(block.content)}</code></pre></div>`;
}

function enhanceInteractivity(result: CompileResult, _ctx: CompileContext): CompileResult {
  const script = `<script>(function(){` +
    `document.querySelectorAll('.mkly-docs-tabs').forEach(function(t){` +
    `var labels=t.querySelectorAll('.mkly-docs-tabs__labels button');` +
    `var panels=t.querySelectorAll('.mkly-docs-tab');` +
    `if(labels.length===0&&panels.length>0){` +
    `var labelBar=document.createElement('div');labelBar.className='mkly-docs-tabs__labels';` +
    `panels.forEach(function(p,i){` +
    `var btn=document.createElement('button');btn.className='mkly-docs-tabs__label'+(i===0?' mkly-docs-tabs__label--active':'');` +
    `btn.textContent=p.getAttribute('data-tab-label')||'Tab '+(i+1);btn.setAttribute('data-index',String(i));` +
    `labelBar.appendChild(btn);` +
    `if(i>0)p.style.display='none';` +
    `});` +
    `t.insertBefore(labelBar,t.firstChild);labels=labelBar.querySelectorAll('button');` +
    `}` +
    `labels.forEach(function(btn){btn.addEventListener('click',function(){` +
    `var idx=parseInt(this.getAttribute('data-index')||'0',10);` +
    `labels.forEach(function(b){b.classList.remove('mkly-docs-tabs__label--active')});` +
    `panels.forEach(function(p){p.style.display='none'});` +
    `this.classList.add('mkly-docs-tabs__label--active');` +
    `if(panels[idx])panels[idx].style.display='';` +
    `})});` +
    `});` +
    `document.querySelectorAll('.mkly-docs-code__copy').forEach(function(btn){` +
    `btn.addEventListener('click',function(){` +
    `var code=this.parentElement.querySelector('code');` +
    `if(code&&navigator.clipboard){navigator.clipboard.writeText(code.textContent||'').then(function(){` +
    `btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy'},2000);` +
    `})}` +
    `})});` +
    `})()</script>`;
  return { ...result, html: result.html + script };
}

function docsLayoutCSS(): string {
  return [
    ':root{--docs-accent:#e2725b;--docs-font:Inter,system-ui,-apple-system,sans-serif;--docs-bg:#ffffff;--docs-text:#1a1a1a;--docs-border:#e5e7eb;--docs-sidebar-width:260px;--docs-nav-height:56px;--docs-main-max:720px}',
    '*{box-sizing:border-box}',
    'body{margin:0;font-family:var(--docs-font);color:var(--docs-text);background:var(--docs-bg);line-height:1.6}',

    '.mkly-docs-nav{position:sticky;top:0;z-index:100;height:var(--docs-nav-height);background:var(--docs-bg);border-bottom:1px solid var(--docs-border)}',
    '.mkly-docs-nav__inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;height:100%;padding:0 24px;gap:12px}',
    '.mkly-docs-nav__brand{font-weight:700;font-size:18px;text-decoration:none;color:var(--docs-text)}',
    '.mkly-docs-nav__version{font-size:12px;padding:2px 8px;border-radius:12px;background:var(--docs-border);color:#666}',
    '.mkly-docs-nav__spacer{flex:1}',
    '.mkly-docs-nav__github{font-size:14px;color:var(--docs-text);text-decoration:none;opacity:0.7}',
    '.mkly-docs-nav__github:hover{opacity:1}',
    '.mkly-docs-nav__hamburger{display:none;background:none;border:none;font-size:20px;cursor:pointer;padding:4px 8px}',

    '.mkly-docs-layout{display:flex;max-width:1200px;margin:0 auto}',
    '.mkly-docs-sidebar{width:var(--docs-sidebar-width);flex-shrink:0;position:sticky;top:var(--docs-nav-height);height:calc(100vh - var(--docs-nav-height));overflow-y:auto;padding:24px;border-right:1px solid var(--docs-border)}',
    '.mkly-docs-main{flex:1;min-width:0;padding:48px}',
    '.mkly-docs-main .mkly-document{max-width:var(--docs-main-max)}',

    '.mkly-docs-footer{text-align:center;padding:32px 24px;border-top:1px solid var(--docs-border);font-size:14px;color:#666}',
    '.mkly-docs-footer a{color:var(--docs-accent);text-decoration:none}',

    '.mkly-docs-heading{position:relative}',
    '.mkly-docs-heading__anchor{position:absolute;left:-1.5em;color:var(--docs-accent);text-decoration:none;opacity:0;font-weight:400;transition:opacity 0.15s}',
    '.mkly-docs-heading:hover .mkly-docs-heading__anchor{opacity:1}',

    '.mkly-docs-code{position:relative}',
    '.mkly-docs-code__copy{position:absolute;top:8px;right:8px;padding:4px 12px;font-size:12px;border:1px solid var(--docs-border);border-radius:4px;background:var(--docs-bg);cursor:pointer;opacity:0;transition:opacity 0.15s}',
    '.mkly-docs-code:hover .mkly-docs-code__copy{opacity:1}',

    '.mkly-docs-tabs__labels{display:flex;gap:0;border-bottom:2px solid var(--docs-border);margin-bottom:16px}',
    '.mkly-docs-tabs__label{padding:8px 16px;border:none;background:none;cursor:pointer;font-size:14px;font-family:var(--docs-font);color:#666;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color 0.15s,border-color 0.15s}',
    '.mkly-docs-tabs__label--active{color:var(--docs-accent);border-bottom-color:var(--docs-accent)}',

    '@media(prefers-color-scheme:dark){:root{--docs-bg:#111;--docs-text:#e5e5e5;--docs-border:#333}.mkly-docs-nav__version{background:#333;color:#aaa}.mkly-docs-code__copy{background:#222;border-color:#444;color:#ccc}.mkly-docs-footer{color:#999}}',

    '@media(max-width:768px){.mkly-docs-sidebar{display:none}.mkly-docs-nav__hamburger{display:block}.mkly-docs-main{padding:24px}}',
  ].join('\n');
}

function wrapDocsOutput(
  content: string,
  meta: Record<string, string>,
  ctx: CompileContext,
  _maxWidth: number,
): string {
  const siteName = ctx.variables.siteName || 'mkly';
  const version = ctx.variables.version || '';
  const githubUrl = ctx.variables.githubUrl || '';
  const siteDescription = ctx.variables.siteDescription || '';
  const title = meta.title ? `${meta.title} — ${siteName}` : siteName;

  const versionBadge = version ? `<span class="mkly-docs-nav__version">${escapeHtml(version)}</span>` : '';
  const githubLink = githubUrl ? `<a href="${escapeHtml(githubUrl)}" class="mkly-docs-nav__github" target="_blank" rel="noopener">GitHub</a>` : '';

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">',
    siteDescription ? `<meta name="description" content="${escapeHtml(siteDescription)}">` : '',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    docsLayoutCSS(),
    '</style>',
    '</head>',
    '<body>',
    `<nav class="mkly-docs-nav">`,
    `<div class="mkly-docs-nav__inner">`,
    `<a href="/" class="mkly-docs-nav__brand">${escapeHtml(siteName)}</a>`,
    versionBadge,
    `<div class="mkly-docs-nav__spacer"></div>`,
    githubLink,
    `<button class="mkly-docs-nav__hamburger" aria-label="Toggle menu">☰</button>`,
    `</div>`,
    `</nav>`,
    `<div class="mkly-docs-layout">`,
    `<aside class="mkly-docs-sidebar" data-sidebar-slot></aside>`,
    `<main class="mkly-docs-main">`,
    `<div class="mkly-document">${content}</div>`,
    `</main>`,
    `</div>`,
    `<footer class="mkly-docs-footer">`,
    `<p>Built with <a href="https://github.com/milkly/mkly">mkly</a></p>`,
    `</footer>`,
    '</body>',
    '</html>',
  ].filter(Boolean).join('\n');
}

export function docsPlugin(options?: { wrap?: boolean }) {
  return definePlugin({
    name: 'docs',
    renderers: {
      'core/heading': headingWithAnchor,
      'core/code': codeWithCopyButton,
    },
    afterCompile: enhanceInteractivity,
    wrapOutput: options?.wrap !== false ? wrapDocsOutput : undefined,
  });
}
