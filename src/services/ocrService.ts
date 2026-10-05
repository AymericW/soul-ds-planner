import { computeOcrScale, preprocessForOcr } from '@/helpers/imagePreprocessing';

export interface OcrProgress {
  /** Human readable step, e.g. "Loading OCR engine…" */
  label: string;
  /** 0-1 */
  progress: number;
}

/** Thrown when the OCR engine cannot be loaded/run (offline first use, old device, ...). */
export class OcrUnavailableError extends Error {}

export interface OcrService {
  /** Reads all text in a screenshot. Rejects with OcrUnavailableError when OCR cannot run. */
  recognize(image: Blob, onProgress?: (p: OcrProgress) => void): Promise<string>;
}

const ENGINE_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new OcrUnavailableError(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Draws the screenshot on a canvas, upscaled and contrast-normalised for OCR. */
async function prepareCanvas(image: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(image);
  const scale = computeOcrScale(bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new OcrUnavailableError('Canvas is not available on this device.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  preprocessForOcr(data.data);
  ctx.putImageData(data, 0, 0);
  return canvas;
}

type TesseractWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>;

/**
 * Tesseract.js, loaded lazily on first use (≈ a few MB of engine + English data
 * from a CDN, then cached by the service worker). One worker is reused.
 */
export function createTesseractOcrService(): OcrService {
  let workerPromise: Promise<TesseractWorker> | null = null;
  let progressListener: ((p: OcrProgress) => void) | undefined;

  const getWorker = () => {
    if (!workerPromise) {
      workerPromise = (async () => {
        const loaded = await import('tesseract.js');
        // tesseract.js is CommonJS: depending on the bundler interop the API is on the namespace or on `default`.
        const api = (loaded as unknown as { default?: typeof loaded }).default ?? loaded;
        const { createWorker, OEM, PSM } = api;
        const worker = await createWorker('eng', OEM.LSTM_ONLY, {
          logger: (m) => {
            const label = m.status.startsWith('recogniz') ? 'Reading names…' : 'Loading OCR engine…';
            progressListener?.({ label, progress: m.progress });
          },
        });
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' });
        return worker;
      })();
      workerPromise.catch(() => {
        workerPromise = null; // allow a retry later (e.g. when back online)
      });
    }
    return workerPromise;
  };

  return {
    async recognize(image, onProgress) {
      progressListener = onProgress;
      onProgress?.({ label: 'Loading OCR engine…', progress: 0 });
      try {
        const worker = await withTimeout(getWorker(), ENGINE_TIMEOUT_MS, 'Loading the OCR engine took too long.');
        const canvas = await prepareCanvas(image);
        const { data } = await worker.recognize(canvas);
        onProgress?.({ label: 'Done', progress: 1 });
        return data.text;
      } catch (error) {
        if (error instanceof OcrUnavailableError) throw error;
        console.warn('OCR unavailable:', error);
        throw new OcrUnavailableError(
          'Automatic reading is not available right now (the OCR engine needs an internet connection the first time it is used). Tick the names by hand in the checklist below.',
        );
      } finally {
        progressListener = undefined;
      }
    },
  };
}
