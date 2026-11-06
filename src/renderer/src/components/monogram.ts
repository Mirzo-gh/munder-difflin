/** Two-letter monogram derived from an agent name (lowercase).
 *  ≥2 words → initials of the first two; 1 word → its first two letters;
 *  no letter/digit at all → '??'. Separators: whitespace, '-', '_', '.'. */
export function monogramLetters(name: string): string {
  const words = name
    .split(/[\s\-_.]+/)
    .map((w) => Array.from(w).filter((ch) => /[\p{L}\p{N}]/u.test(ch)).join(''))
    .filter((w) => w.length > 0);
  if (words.length === 0) return '??';
  const letters = words.length >= 2
    ? Array.from(words[0])[0] + Array.from(words[1])[0]
    : Array.from(words[0]).slice(0, 2).join('');
  return letters.toLocaleLowerCase();
}
