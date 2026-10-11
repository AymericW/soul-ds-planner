import { foldOcrConfusions, similarity } from '@/helpers/fuzzy';
import { normaliseName } from '@/helpers/normalise';
import type { Member } from '@/models/Member';

export interface NameSuggestion {
  member: Member;
  /** 0-1, 1 = same normalised name. */
  score: number;
}

/**
 * Closest roster names for a typed name (join requests): compares the normalised name and its
 * OCR-folded form with each member's name and remembered aliases. Best first.
 */
export function suggestMembersForName(name: string, members: readonly Member[], limit = 3, minScore = 0.4): NameSuggestion[] {
  const key = normaliseName(name);
  if (!key) return [];
  const folded = foldOcrConfusions(key);
  const scored = members.map((member) => {
    const keys = [normaliseName(member.name), ...member.aliases].filter(Boolean);
    let best = 0;
    for (const k of keys) {
      const s = k === key ? 1 : Math.max(similarity(key, k), similarity(folded, foldOcrConfusions(k)) * 0.98, k.includes(key) || key.includes(k) ? 0.75 : 0);
      best = Math.max(best, s);
    }
    return { member, score: best };
  });
  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score || a.member.name.localeCompare(b.member.name))
    .slice(0, limit);
}
