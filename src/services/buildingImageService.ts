import type { BuildingImageContent, BuildingImageDirective } from '@/domain/buildings/buildingImageContent';
import type { BuildingId } from '@/models/Building';

/**
 * Draws the weekly "Affectations des bâtiments" picture with the canvas API (no server):
 * the alliance's own artwork with the names removed (public/desert-storm/buildings-template.webp)
 * is the background, and the team letter, the names on each building, the substitutes and the
 * elimination-squad directives are written on top at the places they had in the original picture.
 */

export const IMAGE_WIDTH = 1445;
export const IMAGE_HEIGHT = 1088;

const TEMPLATE_URL = `${import.meta.env.BASE_URL}desert-storm/buildings-template.webp`;

const NAME_FONT = "'Roboto Condensed', 'Arial Narrow', 'Manrope', system-ui, sans-serif";
const TITLE_FONT = "'Sora', 'Manrope', system-ui, sans-serif";

const COLORS = {
  white: '#ffffff',
  outline: '#05060a',
  number: '#3fe3ff',
  cyan: '#2fe6ff',
  yellow: '#ffe23a',
  green: '#5dff4a',
};

type Align = 'left' | 'center';

/** Where the names of each building go: anchor x, vertical centre of the block, alignment, room available. */
const NAME_SPOTS: Readonly<Record<BuildingId, { x: number; y: number; align: Align; maxWidth: number }>> = {
  info: { x: 462, y: 222, align: 'center', maxWidth: 240 },
  arsenal: { x: 717, y: 268, align: 'center', maxWidth: 230 },
  hospital4: { x: 975, y: 220, align: 'left', maxWidth: 250 },
  refinery1: { x: 255, y: 342, align: 'left', maxWidth: 250 },
  hospital2: { x: 1148, y: 338, align: 'left', maxWidth: 275 },
  silo: { x: 735, y: 437, align: 'center', maxWidth: 250 },
  hospital1: { x: 322, y: 520, align: 'left', maxWidth: 260 },
  refinery2: { x: 1073, y: 518, align: 'left', maxWidth: 280 },
  hospital3: { x: 413, y: 651, align: 'left', maxWidth: 205 },
  mercenary: { x: 728, y: 648, align: 'center', maxWidth: 240 },
  science: { x: 990, y: 651, align: 'left', maxWidth: 260 },
};

const NAME_SIZE = 32;
const NAME_LINE = 35;
const BADGE = 30;

/** The substitutes box (inside the "Remplaçants" frame, left of the soldier). */
const SUBS_BOX = { x: 52, y: 828, w: 270, h: 176 };

interface Column {
  nameX: [number, number];
  textX: [number, number];
  rows: Array<[number, number]>;
  colors: string[];
}

/** The two directive columns of the template, with the row bands next to the icons. */
const DIRECTIVE_COLUMNS: readonly Column[] = [
  {
    nameX: [630, 766],
    textX: [772, 972],
    rows: [
      [838, 886],
      [888, 946],
      [948, 1024],
    ],
    colors: [COLORS.cyan, COLORS.yellow, COLORS.green],
  },
  {
    nameX: [1068, 1196],
    textX: [1202, 1414],
    rows: [
      [836, 912],
      [916, 1022],
    ],
    colors: [COLORS.yellow, COLORS.cyan],
  },
];

type Ctx = CanvasRenderingContext2D;

// ---------- helpers ----------

function setFont(ctx: Ctx, weight: number, size: number, family = NAME_FONT): void {
  ctx.font = `${weight} ${size}px ${family}`;
}

/** Largest size (down to `min`) at which `text` fits in `maxWidth`. */
function fitSize(ctx: Ctx, text: string, maxWidth: number, weight: number, size: number, min: number): number {
  let current = size;
  setFont(ctx, weight, current);
  while (ctx.measureText(text).width > maxWidth && current > min) {
    current -= 1;
    setFont(ctx, weight, current);
  }
  return current;
}

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Game-style text: thick dark outline, soft shadow, then the fill. */
function outlined(ctx: Ctx, text: string, x: number, y: number, fill: string, outline: number): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = outline;
  ctx.strokeText(text, x, y);
  ctx.restore();
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** The round "M1" march badge; (x, y) is its left edge and vertical centre. */
function marchBadge(ctx: Ctx, x: number, y: number, size: number): void {
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + r, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0b10';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 4;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x + r, y, r - 2, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  setFont(ctx, 700, Math.round(size * 0.45));
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M1', x + r, y + 1);
}

// ---------- parts ----------

function drawTeamLetter(ctx: Ctx, team: string): void {
  const letter = team.trim().split(/\s+/).pop() ?? '';
  const x = 907;
  const baseline = 120;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, 800, 56, TITLE_FONT);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 8;
  ctx.strokeText(letter, x, baseline);
  const g = ctx.createLinearGradient(0, baseline - 42, 0, baseline);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#e6e9ef');
  g.addColorStop(1, '#8e96a3');
  ctx.fillStyle = g;
  ctx.fillText(letter, x, baseline);
}

function drawBuildingNames(ctx: Ctx, id: BuildingId, names: readonly string[], nobody: string): void {
  const spot = NAME_SPOTS[id];
  const withBadge = names.length > 0;
  const lines = withBadge ? names : [nobody];
  const top = spot.y - ((lines.length - 1) * NAME_LINE) / 2;
  lines.forEach((name, i) => {
    const y = top + i * NAME_LINE;
    const room = spot.maxWidth - (withBadge ? BADGE + 8 : 0);
    const size = fitSize(ctx, name, room, 700, NAME_SIZE, 18);
    const textWidth = ctx.measureText(name).width;
    const total = textWidth + (withBadge ? 8 + BADGE : 0);
    const left = spot.align === 'center' ? spot.x - total / 2 : spot.x;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    outlined(ctx, name, left, y, COLORS.white, Math.max(4, Math.round(size / 5)));
    if (withBadge) marchBadge(ctx, left + textWidth + 8, y, BADGE);
  });
}

function drawSubstitutes(ctx: Ctx, subs: readonly string[], nobody: string): void {
  const box = SUBS_BOX;
  const list = subs.length ? subs : [nobody];
  const columns = list.length > 5 ? 2 : 1;
  const rows = Math.ceil(list.length / columns);
  const step = Math.min(45, box.h / rows);
  const size = Math.round(Math.min(30, step * 0.7));
  const colWidth = box.w / columns;
  const top = box.y + (box.h - step * rows) / 2 + step / 2;
  const numberWidth = columns === 1 ? 44 : 32;
  const withBadge = subs.length > 0 && columns === 1;
  list.forEach((name, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = box.x + col * colWidth;
    const y = top + row * step;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (subs.length) {
      setFont(ctx, 700, size);
      outlined(ctx, `${i + 1}.`, x + 2, y, COLORS.number, 4);
    }
    const nameX = x + numberWidth;
    const room = colWidth - numberWidth - (withBadge ? BADGE + 14 : 6);
    const used = fitSize(ctx, name, room, 700, size, 13);
    outlined(ctx, name, nameX, y, COLORS.white, Math.max(3, Math.round(used / 6)));
    if (withBadge) marchBadge(ctx, Math.max(258, nameX + ctx.measureText(name).width + 10), y, BADGE);
  });
}

interface DirectiveLayout {
  nameSize: number;
  textSize: number;
  nameLines: string[];
  textLines: string[];
}

function layoutDirective(ctx: Ctx, d: BuildingImageDirective, column: Column, height: number): DirectiveLayout {
  const nameWidth = column.nameX[1] - column.nameX[0];
  const textWidth = column.textX[1] - column.textX[0];
  const label = d.names.length ? d.names.join(' & ') : '–';
  // Squad names: one line if possible, otherwise broken after "&" like the original.
  let nameSize = 26;
  let nameLines: string[] = [label];
  for (; nameSize >= 15; nameSize -= 1) {
    setFont(ctx, 700, nameSize);
    nameLines = ctx.measureText(label).width <= nameWidth ? [label] : wrap(ctx, label, nameWidth);
    const tooWide = nameLines.some((l) => ctx.measureText(l).width > nameWidth);
    if (!tooWide && nameLines.length * (nameSize + 2) <= height - 4) break;
  }
  let textSize = 17;
  let textLines: string[] = [];
  for (; textSize >= 11; textSize -= 1) {
    setFont(ctx, 500, textSize);
    textLines = wrap(ctx, d.text, textWidth);
    if (textLines.length * (textSize + 3) <= height - 6) break;
  }
  return { nameSize, textSize, nameLines, textLines };
}

function drawDirectives(ctx: Ctx, content: BuildingImageContent): void {
  content.phases.forEach((phase, p) => {
    const column = DIRECTIVE_COLUMNS[p];
    if (!column) return;
    const first = column.rows[0]![0];
    const last = column.rows[column.rows.length - 1]![1];
    const bands =
      column.rows.length === phase.directives.length
        ? column.rows
        : phase.directives.map((_, i): [number, number] => {
            const h = (last - first) / phase.directives.length;
            return [first + i * h, first + (i + 1) * h];
          });
    phase.directives.forEach((d, i) => {
      const [y0, y1] = bands[i]!;
      const mid = (y0 + y1) / 2;
      const layout = layoutDirective(ctx, d, column, y1 - y0);
      const color = column.colors[i % column.colors.length]!;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      setFont(ctx, 700, layout.nameSize);
      const nameCx = (column.nameX[0] + column.nameX[1]) / 2;
      const nameTop = mid - ((layout.nameLines.length - 1) * (layout.nameSize + 2)) / 2;
      layout.nameLines.forEach((line, k) => outlined(ctx, line, nameCx, nameTop + k * (layout.nameSize + 2), color, 4));

      ctx.textAlign = 'left';
      setFont(ctx, 500, layout.textSize);
      ctx.fillStyle = COLORS.white;
      const lineH = layout.textSize + 3;
      const textTop = mid - ((layout.textLines.length - 1) * lineH) / 2;
      layout.textLines.forEach((line, k) => ctx.fillText(line, column.textX[0], textTop + k * lineH));
    });
  });
}

// ---------- loading ----------

let templatePromise: Promise<HTMLImageElement> | null = null;

function loadTemplate(): Promise<HTMLImageElement> {
  templatePromise ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => {
      templatePromise = null;
      reject(new Error('the background picture could not be loaded (check the connection and try again)'));
    };
    img.src = TEMPLATE_URL;
  });
  return templatePromise;
}

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`700 32px ${NAME_FONT}`),
      document.fonts.load(`500 17px ${NAME_FONT}`),
      document.fonts.load(`800 56px ${TITLE_FONT}`),
    ]);
  } catch {
    /* system fonts are used instead */
  }
}

// ---------- public API ----------

/** Renders the picture to a PNG blob. */
export async function renderBuildingImage(content: BuildingImageContent): Promise<Blob> {
  const [template] = await Promise.all([loadTemplate(), ensureFonts()]);
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported on this device.');

  ctx.drawImage(template, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  drawTeamLetter(ctx, content.team);
  for (const building of content.buildings) drawBuildingNames(ctx, building.id, building.names, content.nobody);
  drawSubstitutes(ctx, content.substitutes, content.nobody);
  drawDirectives(ctx, content);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))), 'image/png');
  });
}

/** Saves a blob through a temporary download link. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** True when the device can hand image files to other apps (phones: the share sheet). */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/** Opens the share sheet with the images; false when the user cancelled or sharing is unavailable. */
export async function shareFiles(files: File[], title: string): Promise<boolean> {
  if (!canShareFiles()) return false;
  try {
    await navigator.share({ files, title });
    return true;
  } catch {
    return false;
  }
}
