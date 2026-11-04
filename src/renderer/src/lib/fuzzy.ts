/**
 * Small fuzzy matcher for the command palette.
 * Returns a score (higher is better) or -1 if the query does not match.
 * Rewards consecutive characters, word starts and prefix matches.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const t = text.toLowerCase()

  const direct = t.indexOf(q)
  if (direct !== -1) return 1000 - direct * 2 - (t.length - q.length) * 0.1

  let score = 0
  let ti = 0
  let streak = 0
  for (const ch of q) {
    if (ch === ' ') continue
    const found = t.indexOf(ch, ti)
    if (found === -1) return -1
    const wordStart = found === 0 || /[\s\-_/.]/.test(t[found - 1] ?? '')
    streak = found === ti ? streak + 1 : 0
    score += 10 + streak * 6 + (wordStart ? 12 : 0) - Math.min(found - ti, 10)
    ti = found + 1
  }
  return score
}

/** Indices of characters to highlight for a matched query. */
export function fuzzyHighlights(query: string, text: string): Set<number> {
  const q = query.trim().toLowerCase()
  const t = text.toLowerCase()
  const out = new Set<number>()
  if (!q) return out
  const direct = t.indexOf(q)
  if (direct !== -1) {
    for (let i = 0; i < q.length; i++) out.add(direct + i)
    return out
  }
  let ti = 0
  for (const ch of q) {
    if (ch === ' ') continue
    const found = t.indexOf(ch, ti)
    if (found === -1) break
    out.add(found)
    ti = found + 1
  }
  return out
}
