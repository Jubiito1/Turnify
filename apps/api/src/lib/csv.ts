/**
 * Minimal RFC 4180 CSV writer with protection against CSV/formula injection:
 * cells starting with = + - @ (or tab/CR) are prefixed with a single quote so spreadsheet
 * apps treat them as text.
 */
function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r;]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

const BOM = String.fromCharCode(0xfeff);

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(','));
  // BOM so Excel opens UTF-8 (accents) correctly.
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
