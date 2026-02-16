import { PROMPTS } from './prompts/embedded';

export function buildPrompt(name: string, variables: Record<string, string> = {}): string {
  const template = PROMPTS[name];
  if (!template) {
    throw new Error(`Unknown prompt: ${name}`);
  }
  return replaceVariables(template, variables);
}

export function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}
