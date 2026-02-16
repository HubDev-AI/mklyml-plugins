import { parse } from '@mklyml/core';
import type { MklyBlock } from '@mklyml/core';
import type { TemplateManifest, TemplateManifestSection } from './types';

export function extractManifest(source: string): TemplateManifest {
  const doc = parse(source);

  const manifest: TemplateManifest = {
    title: doc.meta.title,
    subject: doc.meta.subject,
    kitsUsed: [...doc.uses],
    styleVariables: {},
    sections: [],
    warnings: [],
  };

  for (const styleText of doc.styles) {
    for (const line of styleText.split('\n')) {
      const match = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
      if (match) {
        manifest.styleVariables[match[1]] = match[2].trim();
      }
    }
  }

  for (const block of doc.blocks) {
    if (block.blockType === 'meta' || block.blockType === 'style' || block.blockType === 'use') {
      continue;
    }
    manifest.sections.push(blockToManifestSection(block));
  }

  for (const error of doc.errors) {
    manifest.warnings.push(`Line ${error.line}: ${error.message}`);
  }

  return manifest;
}

function blockToManifestSection(block: MklyBlock): TemplateManifestSection {
  return {
    blockType: block.blockType,
    label: block.label ?? block.properties.title,
    properties: { ...block.properties },
    isContainer: block.children.length > 0,
    children: block.children.map(blockToManifestSection),
  };
}
