/**
 * Base card builder utilities
 */

export function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }
  return result;
}

export function buildCard(template: any, variables: Record<string, string>): any {
  const templateStr = JSON.stringify(template);
  const replaced = replaceVariables(templateStr, variables);
  return JSON.parse(replaced);
}
