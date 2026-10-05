import { OCR_MATCH_THRESHOLD, OCR_NOISE_WORDS, OCR_SHORT_NAME_LENGTH, OCR_SHORT_NAME_THRESHOLD } from '@/constants/rules';
import { foldOcrConfusions, similarity } from './fuzzy';
import { normaliseName } from './normalise';

/** What the matcher needs to know about a member. */
export interface NameCandidate {
  id: string;
  name: string;
  /** Already-normalised alternative spellings (learnt from user corrections). */
  aliases: readonly string[];
}

export interface OcrLineMatch {
  memberId: string;
  /** The OCR line the member was found on. */
  line: string;
  /** 0-1 confidence of the match. */
  score: number;
  /** 'alias' when the match came from a remembered correction. */
  via: 'name' | 'alias';
}

export interface OcrMatchResult {
  /** At most one entry per member (the best one), in order of appearance. */
  matches: OcrLineMatch[];
  /** Lines that look like a name but matched nobody (offered for manual assignment). */
  unmatched: UnmatchedLine[];
}

export interface UnmatchedLine {
  /** Cleaned OCR line. */
  line: string;
  /** Most name-like word of the line (what gets remembered as alias when assigned). */
  guess: string;
}

export interface MatchOptions {
  threshold?: number;
  shortNameLength?: number;
  shortNameThreshold?: number;
}

/** Removes typical non-name noise from one OCR line. */
export function cleanOcrLine(line: string): string {
  return line
    .replace(/[[({<][^\])}>]{0,8}[\])}>]/g, ' ') // [SOUL], (SOUL), <tag>
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ') // times
    .replace(/\b\d+(?:[.,]\d+)*\s?[kmb]?\b/gi, ' ') // standalone numbers: 980, 12.3M (not digits inside names)
    .replace(/\s+/g, ' ')
    .trim();
}

interface Token {
  key: string;
  folded: string;
  /** Indices of the words that form this token. */
  words: number[];
}

/** Single words plus windows of 2-3 adjacent words (names may contain spaces or be split by OCR). */
function tokenise(cleanedLine: string): Token[] {
  const words = cleanedLine.split(' ').filter(Boolean);
  const tokens: Token[] = [];
  for (let size = 1; size <= 3; size++) {
    for (let start = 0; start + size <= words.length; start++) {
      const key = normaliseName(words.slice(start, start + size).join(''));
      if (!key) continue;
      tokens.push({ key, folded: foldOcrConfusions(key), words: Array.from({ length: size }, (_, i) => start + i) });
    }
  }
  return tokens;
}

interface MemberKey {
  memberId: string;
  key: string;
  folded: string;
  via: 'name' | 'alias';
}

/** How well a token matches a member key (0-1). */
export function scoreToken(tokenKey: string, tokenFolded: string, memberKey: string, memberFolded: string, opts: Required<MatchOptions>): number {
  if (tokenKey === memberKey) return 1;
  if (tokenFolded === memberFolded) return 0.97;
  const isShort = memberKey.length <= opts.shortNameLength;
  // glued prefixes/suffixes such as "SOULIronVanguard" (only a few extra characters)
  if (!isShort && tokenFolded.length <= memberFolded.length + 4 && tokenFolded.includes(memberFolded)) return 0.93;
  const sim = similarity(tokenFolded, memberFolded);
  return sim >= (isShort ? opts.shortNameThreshold : opts.threshold) ? sim : 0;
}

const NOISE = new Set(OCR_NOISE_WORDS);

/**
 * For a line that matched nobody: returns the most name-like word, or null when
 * the line is UI text (headers, sentences) rather than a player name.
 */
export function guessNameFromLine(cleaned: string): string | null {
  const words = cleaned
    .split(' ')
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}_]+$/gu, ''))
    .filter((w) => normaliseName(w).length >= 3 && !NOISE.has(normaliseName(w)));
  if (words.length === 0 || words.length > 3) return null;
  const best = [...words].sort((a, b) => normaliseName(b).length - normaliseName(a).length)[0]!;
  return (best.match(/\p{L}/gu) ?? []).length >= 2 ? best : null;
}

/**
 * Matches raw OCR text against the roster.
 * Each line can yield several members (if OCR merged columns), but each word
 * is used for one member only; each member keeps its best line.
 */
export function matchOcrText(text: string, candidates: readonly NameCandidate[], options: MatchOptions = {}): OcrMatchResult {
  const opts: Required<MatchOptions> = {
    threshold: options.threshold ?? OCR_MATCH_THRESHOLD,
    shortNameLength: options.shortNameLength ?? OCR_SHORT_NAME_LENGTH,
    shortNameThreshold: options.shortNameThreshold ?? OCR_SHORT_NAME_THRESHOLD,
  };
  const keys: MemberKey[] = [];
  for (const c of candidates) {
    const nameKey = normaliseName(c.name);
    if (nameKey) keys.push({ memberId: c.id, key: nameKey, folded: foldOcrConfusions(nameKey), via: 'name' });
    for (const alias of c.aliases) {
      const aliasKey = normaliseName(alias);
      if (aliasKey) keys.push({ memberId: c.id, key: aliasKey, folded: foldOcrConfusions(aliasKey), via: 'alias' });
    }
  }

  const best = new Map<string, OcrLineMatch & { position: number }>();
  const unmatched: UnmatchedLine[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  lines.forEach((line, lineIndex) => {
    const cleaned = cleanOcrLine(line);
    const tokens = tokenise(cleaned);
    const scored: Array<{ key: MemberKey; token: Token; score: number }> = [];
    for (const key of keys) {
      let top: { token: Token; score: number } | undefined;
      for (const token of tokens) {
        const score = scoreToken(token.key, token.folded, key.key, key.folded, opts);
        if (score > 0 && (!top || score > top.score)) top = { token, score };
      }
      if (top) scored.push({ key, ...top });
    }
    scored.sort((a, b) => b.score - a.score || b.token.key.length - a.token.key.length);
    const usedWords = new Set<number>();
    const usedMembers = new Set<string>();
    let found = false;
    for (const s of scored) {
      if (usedMembers.has(s.key.memberId) || s.token.words.some((w) => usedWords.has(w))) continue;
      s.token.words.forEach((w) => usedWords.add(w));
      usedMembers.add(s.key.memberId);
      found = true;
      const previous = best.get(s.key.memberId);
      if (!previous || s.score > previous.score) {
        best.set(s.key.memberId, { memberId: s.key.memberId, line, score: s.score, via: s.key.via, position: lineIndex });
      }
    }
    if (!found) {
      const guess = guessNameFromLine(cleaned);
      if (guess) unmatched.push({ line: cleaned, guess });
    }
  });

  const matches = [...best.values()]
    .sort((a, b) => a.position - b.position)
    .map(({ position: _position, ...m }) => m);
  return { matches, unmatched };
}
