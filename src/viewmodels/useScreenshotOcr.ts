import { t } from '@/helpers/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { matchOcrText, type NameCandidate, type OcrMatchResult, type UnmatchedLine } from '@/helpers/nameMatching';
import { OcrUnavailableError } from '@/services/ocrService';
import { useAppServices } from './AppServicesContext';

export type OcrStatus = 'idle' | 'working' | 'done' | 'failed';

export interface ScreenshotOcrState {
  imageUrl: string | null;
  status: OcrStatus;
  progressLabel: string;
  progress: number;
  /** Friendly message shown under the screenshot (errors included). */
  message: string | null;
  matchedIds: string[];
  unmatched: UnmatchedLine[];
}

const INITIAL: ScreenshotOcrState = {
  imageUrl: null,
  status: 'idle',
  progressLabel: '',
  progress: 0,
  message: null,
  matchedIds: [],
  unmatched: [],
};

/**
 * Shared screenshot -> OCR -> roster matching flow (poll and attendance steps).
 * `onMatched` receives the member ids found so the caller can tick them.
 */
export function useScreenshotOcr(candidates: readonly NameCandidate[], onMatched: (result: OcrMatchResult) => void) {
  const { ocr } = useAppServices();
  const [state, setState] = useState<ScreenshotOcrState>(INITIAL);
  const urlRef = useRef<string | null>(null);
  const runId = useRef(0);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const run = useCallback(
    async (image: Blob) => {
      const id = ++runId.current;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const imageUrl = URL.createObjectURL(image);
      urlRef.current = imageUrl;
      setState({ ...INITIAL, imageUrl, status: 'working', progressLabel: t().services.ocrLoading });
      try {
        const text = await ocr.recognize(image, (p) => {
          if (runId.current === id) setState((s) => ({ ...s, progressLabel: p.label, progress: p.progress }));
        });
        if (runId.current !== id) return;
        const result = matchOcrText(text, candidates);
        setState((s) => ({
          ...s,
          status: 'done',
          progress: 1,
          matchedIds: result.matches.map((m) => m.memberId),
          unmatched: result.unmatched,
          message:
            result.matches.length > 0
              ? t().week.recognised(result.matches.length)
              : t().week.noneRecognised,
        }));
        onMatched(result);
      } catch (error) {
        if (runId.current !== id) return;
        const message =
          error instanceof OcrUnavailableError
            ? error.message
            : t().week.ocrFailed;
        setState((s) => ({ ...s, status: 'failed', message }));
      }
    },
    [ocr, candidates, onMatched],
  );

  const dismissUnmatched = useCallback((guess: string) => {
    setState((s) => ({ ...s, unmatched: s.unmatched.filter((u) => u.guess !== guess) }));
  }, []);

  const clear = useCallback(() => {
    runId.current++;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setState(INITIAL);
  }, []);

  return { ...state, run, dismissUnmatched, clear };
}

export type ScreenshotOcr = ReturnType<typeof useScreenshotOcr>;
