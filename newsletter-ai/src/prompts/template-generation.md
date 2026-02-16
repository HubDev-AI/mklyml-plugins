# Newsletter Template Generation

PROMPT VERSION: v1.0

Generate a newsletter template in mkly markup. The template should have placeholder content that the user can customize.

## Context

- Stream/Theme: "{{streamName}}"
- Content Categories: {{categories}}
{{customContext}}

## Archetype Guidance

{{archetypeGuidance}}

## Template Requirements

1. Start with `--- meta` block (version: 1, title)
2. Include `--- use: newsletter`
3. Include `--- style` block with color variables
4. Use newsletter kit blocks for structure
5. Use [Bracketed Placeholder] text for editable content
6. Aim for 5-8 sections total

## Placeholder Rules

- Use [Bracketed Text] for editable content: [Your Newsletter Title], [Company Name]
- Use obvious fake names: "Acme Corp", "Jane Doe", "[Your Name]"
- NEVER use real company names, real products, or real data
- Make it obvious what needs replacement

## Output

Return ONLY valid mkly markup. No code fences, no explanations.
