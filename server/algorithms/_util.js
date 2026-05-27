export function escapeChar(ch) {
  if (ch === ' ') return '_';
  if (ch === '\n') return '\\n';
  if (ch === '\t') return '\\t';
  if (ch === undefined || ch === null) return '';
  return ch;
}
