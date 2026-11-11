import type { BuildingImageContent, BuildingImageDirective, BuildingImagePhase } from '@/domain/buildings/buildingImageContent';
import type { BuildingId } from '@/models/Building';

/**
 * Draws the weekly "Affectations des bâtiments" picture with the canvas API (no server,
 * no image asset): a desert scene with the 11 buildings, the names placed on them,
 * the substitutes box and the elimination-squad directives.
 */

export const IMAGE_WIDTH = 1440;
export const IMAGE_HEIGHT = 1080;

const DISPLAY_FONT = "'Sora', 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const BODY_FONT = "'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const COLORS = {
  sandTop: '#d9743a',
  sandMid: '#c9582b',
  sandBottom: '#9a3b1c',
  dune: 'rgba(255, 190, 120, 0.22)',
  canyon: 'rgba(80, 25, 10, 0.38)',
  track: 'rgba(255, 225, 180, 0.18)',
  gold: '#ffc83d',
  goldDark: '#c97a12',
  panel: 'rgba(8, 10, 18, 0.86)',
  panelBorder: 'rgba(255, 200, 61, 0.75)',
  label: 'rgba(10, 12, 20, 0.9)',
  labelBorder: 'rgba(255, 255, 255, 0.55)',
  white: '#ffffff',
  cyan: '#38e0ff',
  yellow: '#ffe13d',
  green: '#7cff5a',
  red: '#ff5a5a',
  blueBase: '#2fa8ff',
  redBase: '#ff3b3b',
};

/** Where each building sits on the map (centre of its block). */
const POSITIONS: Readonly<Record<BuildingId, { x: number; y: number }>> = {
  info: { x: 455, y: 235 },
  arsenal: { x: 715, y: 275 },
  hospital4: { x: 1005, y: 235 },
  refinery1: { x: 310, y: 355 },
  hospital2: { x: 1215, y: 345 },
  silo: { x: 715, y: 445 },
  hospital1: { x: 335, y: 530 },
  refinery2: { x: 1135, y: 525 },
  hospital3: { x: 430, y: 655 },
  mercenary: { x: 715, y: 655 },
  science: { x: 1060, y: 655 },
};

const SQUAD_COLORS = [COLORS.cyan, COLORS.yellow, COLORS.green];

type Ctx = CanvasRenderingContext2D;

// ---------- small drawing helpers ----------

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function panel(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lineWidth = 3): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/** White (or coloured) text with a dark outline, readable on any background. */
function outlined(ctx: Ctx, text: string, x: number, y: number, fill = COLORS.white, outline = 5): void {
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.lineWidth = outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Shrinks the font until the text fits in `maxWidth` (never below `minSize`). Returns the size used. */
function fitFont(ctx: Ctx, text: string, maxWidth: number, family: string, weight: number, size: number, minSize: number): number {
  let current = size;
  ctx.font = `${weight} ${current}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && current > minSize) {
    current -= 1;
    ctx.font = `${weight} ${current}px ${family}`;
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

function goldGradient(ctx: Ctx, y: number, h: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y - h, 0, y);
  g.addColorStop(0, '#fff2b0');
  g.addColorStop(0.5, COLORS.gold);
  g.addColorStop(1, COLORS.goldDark);
  return g;
}

/** The "M1" march badge after each name. */
function marchBadge(ctx: Ctx, x: number, y: number, size: number): void {
  const r = size * 0.42;
  ctx.beginPath();
  ctx.arc(x + r, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0d14';
  ctx.fill();
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `800 ${Math.round(size * 0.46)}px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M1', x + r, y + 1);
}

// ---------- scene ----------

function drawBackground(ctx: Ctx): void {
  const sky = ctx.createLinearGradient(0, 0, 0, IMAGE_HEIGHT);
  sky.addColorStop(0, COLORS.sandTop);
  sky.addColorStop(0.55, COLORS.sandMid);
  sky.addColorStop(1, COLORS.sandBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  // Dunes: soft light arcs across the plain.
  ctx.fillStyle = COLORS.dune;
  const dunes = [
    [200, 320, 520, 90],
    [900, 300, 600, 80],
    [500, 600, 700, 110],
    [1150, 620, 420, 90],
    [250, 760, 500, 70],
  ] as const;
  for (const [x, y, w, h] of dunes) {
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Canyons / rocky edges in the corners.
  ctx.fillStyle = COLORS.canyon;
  const rocks = [
    [-60, -40, 420, 220],
    [1100, -60, 460, 240],
    [-80, 560, 300, 420],
    [1260, 560, 320, 420],
  ] as const;
  for (const [x, y, w, h] of rocks) {
    roundRect(ctx, x, y, w, h, 120);
    ctx.fill();
  }

  // Sand tracks from the Silo to every building.
  ctx.save();
  ctx.strokeStyle = COLORS.track;
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 14]);
  const centre = POSITIONS.silo;
  for (const [id, p] of Object.entries(POSITIONS) as [BuildingId, { x: number; y: number }][]) {
    if (id === 'silo') continue;
    ctx.beginPath();
    ctx.moveTo(centre.x, centre.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.restore();

  // Team bases.
  drawDiamond(ctx, 100, 480, 48, COLORS.blueBase);
  drawDiamond(ctx, 1340, 480, 48, COLORS.redBase);

  // Vignette.
  const v = ctx.createRadialGradient(IMAGE_WIDTH / 2, IMAGE_HEIGHT / 2, IMAGE_HEIGHT * 0.35, IMAGE_WIDTH / 2, IMAGE_HEIGHT / 2, IMAGE_WIDTH * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
}

function drawDiamond(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.6, 1);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawHeader(ctx: Ctx, content: BuildingImageContent): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Alliance badge.
  const bx = 300;
  const by = 100;
  ctx.beginPath();
  ctx.arc(bx, by, 62, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0d14';
  ctx.fill();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.font = `800 40px ${DISPLAY_FONT}`;
  ctx.fillStyle = goldGradient(ctx, by + 14, 40);
  ctx.fillText('SOUL', bx, by + 14);
  ctx.font = `700 13px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.white;
  ctx.fillText('DESERT STORM', bx, by + 36);

  // Title.
  const cx = 800;
  ctx.font = `800 66px ${DISPLAY_FONT}`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 10;
  ctx.strokeText(content.title, cx, 78);
  ctx.fillStyle = goldGradient(ctx, 78, 66);
  ctx.fillText(content.title, cx, 78);

  ctx.font = `800 50px ${DISPLAY_FONT}`;
  ctx.lineWidth = 8;
  ctx.strokeText(content.team, cx, 132);
  ctx.fillStyle = goldGradient(ctx, 132, 50);
  ctx.fillText(content.team, cx, 132);
  // Wings either side of the team name.
  const half = ctx.measureText(content.team).width / 2 + 30;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 5;
  for (const dir of [-1, 1]) {
    for (const [dy, len] of [
      [-16, 70],
      [-4, 55],
      [8, 40],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * half, 118 + dy);
      ctx.lineTo(cx + dir * (half + len), 118 + dy - 6);
      ctx.stroke();
    }
  }

  ctx.font = `700 26px ${BODY_FONT}`;
  const subtitleWidth = ctx.measureText(content.subtitle).width + 50;
  panel(ctx, cx - subtitleWidth / 2, 150, subtitleWidth, 42, 10, COLORS.label, COLORS.labelBorder, 2);
  ctx.fillStyle = COLORS.white;
  ctx.fillText(content.subtitle, cx, 180);

  ctx.font = `600 20px ${BODY_FONT}`;
  outlined(ctx, content.dateLabel, cx, 215, COLORS.white, 4);
}

// ---------- building icons (simple pseudo-isometric glyphs) ----------

function drawBuildingIcon(ctx: Ctx, id: BuildingId, cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  // Ground plate.
  ctx.beginPath();
  ctx.ellipse(0, 28, 44, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  switch (id) {
    case 'hospital1':
    case 'hospital2':
    case 'hospital3':
    case 'hospital4':
      box(ctx, -30, -22, 60, 46, '#f2c02e', '#b88a12', '#fff0a0');
      ctx.beginPath();
      ctx.arc(-14, -12, 12, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
      ctx.fillStyle = '#e02222';
      ctx.fillRect(-17, -14, 6, 4);
      ctx.fillRect(-16, -19, 4, 14);
      break;
    case 'refinery1':
    case 'refinery2':
      cylinder(ctx, -22, -14, 20, 40, '#2f8f4e', '#1c5a30', '#7fe39a');
      cylinder(ctx, 10, -2, 16, 30, '#2f8f4e', '#1c5a30', '#7fe39a');
      ctx.fillStyle = '#d0d0d0';
      ctx.fillRect(-8, 8, 20, 4);
      break;
    case 'silo':
      ctx.beginPath();
      ctx.ellipse(0, 14, 40, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#243b6b';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 8, 28, Math.PI, 0);
      ctx.fillStyle = '#3f8fe0';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-8, -18);
      ctx.lineTo(0, -40);
      ctx.lineTo(8, -18);
      ctx.closePath();
      ctx.fillStyle = COLORS.yellow;
      ctx.fill();
      ctx.fillStyle = '#9fd4ff';
      ctx.fillRect(-20, -4, 8, 8);
      ctx.fillRect(12, -4, 8, 8);
      break;
    case 'science':
      ctx.beginPath();
      ctx.ellipse(0, 16, 40, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1b4e8a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 8, 26, Math.PI, 0);
      ctx.fillStyle = '#f3f3f3';
      ctx.fill();
      ctx.strokeStyle = '#9fb7d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 8, 26, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.fillStyle = COLORS.cyan;
      ctx.fillRect(-2, -34, 4, 18);
      ctx.beginPath();
      ctx.arc(0, -36, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'info':
      box(ctx, -14, -30, 28, 60, '#2d6fb5', '#173c66', '#8cc4ff');
      ctx.beginPath();
      ctx.arc(14, -30, 14, Math.PI * 0.9, Math.PI * 1.9);
      ctx.strokeStyle = COLORS.yellow;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(10, -30, 4, 14);
      box(ctx, -34, 4, 26, 22, '#2d6fb5', '#173c66', '#8cc4ff');
      break;
    case 'arsenal':
      box(ctx, -36, -14, 72, 40, '#1f2d55', '#0d1530', '#4f66a8');
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(-36, -2, 72, 6);
      box(ctx, -14, -36, 28, 24, '#1f2d55', '#0d1530', '#4f66a8');
      ctx.fillStyle = '#c9c9c9';
      ctx.fillRect(4, -32, 30, 6);
      break;
    case 'mercenary':
      box(ctx, -36, -10, 72, 36, '#e3b122', '#9a7510', '#ffe37a');
      ctx.fillStyle = '#6b6b6b';
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-36 + i * 24, -10);
        ctx.lineTo(-24 + i * 24, -28);
        ctx.lineTo(-12 + i * 24, -10);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(22, -40, 10, 32);
      break;
    default:
      break;
  }
  ctx.restore();
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, front: string, side: string, top: string): void {
  ctx.fillStyle = front;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = side;
  ctx.fillRect(x + w, y - 8, 10, h);
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 10, y - 8);
  ctx.lineTo(x + w + 10, y - 8);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();
}

function cylinder(ctx: Ctx, x: number, y: number, r: number, h: number, body: string, shade: string, top: string): void {
  ctx.fillStyle = body;
  ctx.fillRect(x - r, y, r * 2, h);
  ctx.fillStyle = shade;
  ctx.fillRect(x + r * 0.4, y, r * 0.6, h);
  ctx.beginPath();
  ctx.ellipse(x, y + h, r, r * 0.4, 0, 0, Math.PI);
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = top;
  ctx.fill();
}

function drawBuilding(ctx: Ctx, building: BuildingImageContent['buildings'][number], nobody: string): void {
  const { x, y } = POSITIONS[building.id];
  drawBuildingIcon(ctx, building.id, x - 92, y);

  // Names, stacked to the right of the icon.
  const names = building.names.length ? building.names : [nobody];
  const lineHeight = 38;
  const startY = y - ((names.length - 1) * lineHeight) / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  names.forEach((name, i) => {
    const ny = startY + i * lineHeight;
    const size = fitFont(ctx, name, 150, DISPLAY_FONT, 800, 32, 20);
    outlined(ctx, name, x - 40, ny, COLORS.white, 6);
    if (building.names.length) marchBadge(ctx, x - 40 + ctx.measureText(name).width + 8, ny, size);
    ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
  });

  // Label pill under the block.
  ctx.font = `700 21px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(building.label).width + 32;
  panel(ctx, x - w / 2, y + 48, w, 34, 8, COLORS.label, COLORS.labelBorder, 2);
  ctx.fillStyle = COLORS.white;
  ctx.fillText(building.label, x, y + 66);
}

function drawSubstitutes(ctx: Ctx, content: BuildingImageContent): void {
  const x = 20;
  const y = 770;
  const w = 440;
  const h = 290;
  panel(ctx, x, y, w, h, 18, COLORS.panel, COLORS.cyan, 3);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 32px ${DISPLAY_FONT}`;
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText(content.substitutesTitle, x + 24, y + 48);

  const subs = content.substitutes.length ? content.substitutes : [content.nobody];
  const available = h - 80;
  const lineHeight = Math.min(42, available / subs.length);
  const size = Math.min(28, Math.round(lineHeight * 0.68));
  subs.forEach((name, i) => {
    const ny = y + 70 + i * lineHeight + lineHeight / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `700 ${size}px ${DISPLAY_FONT}`;
    ctx.fillStyle = COLORS.white;
    const prefix = content.substitutes.length ? `${i + 1}.` : '';
    ctx.fillText(prefix, x + 28, ny);
    const used = fitFont(ctx, name, w - 140, DISPLAY_FONT, 700, size, 16);
    ctx.fillText(name, x + 72, ny);
    if (content.substitutes.length) marchBadge(ctx, x + 72 + ctx.measureText(name).width + 10, ny, used);
  });
}

interface PhaseLayout {
  fontSize: number;
  lines: Array<{ directive: BuildingImageDirective; nameLines: string[]; textLines: string[]; height: number }>;
  height: number;
}

function layoutPhase(ctx: Ctx, phase: BuildingImagePhase, nameWidth: number, textWidth: number, fontSize: number): PhaseLayout {
  const lines = phase.directives.map((directive) => {
    ctx.font = `800 ${fontSize + 3}px ${DISPLAY_FONT}`;
    const nameLines = directive.names.length ? wrap(ctx, directive.names.join(' & '), nameWidth) : ['–'];
    ctx.font = `600 ${fontSize}px ${BODY_FONT}`;
    const textLines = wrap(ctx, directive.text, textWidth);
    const height = Math.max(nameLines.length * (fontSize + 7), textLines.length * (fontSize + 5)) + 12;
    return { directive, nameLines, textLines, height };
  });
  return { fontSize, lines, height: lines.reduce((n, l) => n + l.height, 0) };
}

function drawDirectives(ctx: Ctx, content: BuildingImageContent): void {
  const x = 480;
  const y = 770;
  const w = 940;
  const h = 290;
  panel(ctx, x, y, w, h, 18, COLORS.panel, COLORS.panelBorder, 3);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 26px ${DISPLAY_FONT}`;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`★ ${content.directivesTitle}`, x + w / 2, y + 38);

  const columns = content.phases.length || 1;
  const gap = 14;
  const colW = (w - 28 - gap * (columns - 1)) / columns;
  const headerH = 34;
  const bodyTop = y + 52 + headerH + 8;
  const bodyH = y + h - 12 - bodyTop;
  const nameWidth = Math.round(colW * 0.3);
  const textWidth = colW - nameWidth - 28;

  // Both phases use the same text size: the largest at which every column fits.
  const fitLayout = (phase: BuildingImagePhase, size: number) => {
    let layout = layoutPhase(ctx, phase, nameWidth, textWidth, size);
    while (layout.height > bodyH && layout.fontSize > 11) layout = layoutPhase(ctx, phase, nameWidth, textWidth, layout.fontSize - 1);
    return layout;
  };
  const fontSize = Math.min(17, ...content.phases.map((phase) => fitLayout(phase, 17).fontSize));

  content.phases.forEach((phase, index) => {
    const cx = x + 14 + index * (colW + gap);
    const accent = index === 0 ? COLORS.cyan : COLORS.red;
    panel(ctx, cx, y + 52, colW, h - 64, 12, 'rgba(255,255,255,0.04)', accent, 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const title = phase.title.toUpperCase();
    fitFont(ctx, title, colW - 24, DISPLAY_FONT, 800, 19, 12);
    ctx.fillStyle = accent;
    ctx.fillText(title, cx + colW / 2, y + 52 + 24);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + 10, y + 52 + headerH);
    ctx.lineTo(cx + colW - 10, y + 52 + headerH);
    ctx.stroke();

    const layout = layoutPhase(ctx, phase, nameWidth, textWidth, fontSize);
    let ly = bodyTop;
    layout.lines.forEach((line, i) => {
      const color = SQUAD_COLORS[i % SQUAD_COLORS.length] ?? COLORS.white;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `800 ${layout.fontSize + 3}px ${DISPLAY_FONT}`;
      ctx.fillStyle = color;
      line.nameLines.forEach((t, k) => ctx.fillText(t, cx + 14, ly + k * (layout.fontSize + 7)));
      ctx.font = `600 ${layout.fontSize}px ${BODY_FONT}`;
      ctx.fillStyle = COLORS.white;
      line.textLines.forEach((t, k) => ctx.fillText(t, cx + 14 + nameWidth + 10, ly + k * (layout.fontSize + 5)));
      ly += line.height;
    });
  });
}

// ---------- public API ----------

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`800 40px ${DISPLAY_FONT}`),
      document.fonts.load(`700 40px ${DISPLAY_FONT}`),
      document.fonts.load(`700 20px ${BODY_FONT}`),
      document.fonts.load(`600 20px ${BODY_FONT}`),
    ]);
  } catch {
    /* system fonts are used instead */
  }
}

/** Renders the picture to a PNG blob. */
export async function renderBuildingImage(content: BuildingImageContent): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported on this device.');

  drawBackground(ctx);
  drawHeader(ctx, content);
  for (const building of content.buildings) drawBuilding(ctx, building, content.nobody);
  drawSubstitutes(ctx, content);
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
