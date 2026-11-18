import Phaser from 'phaser';
import type { LevelDefinition, PathSegment } from '../types';
import { PRINT_PALETTE } from './PrintArtFactory';

const SHEET_BOTTOM_Y = 44 + 452; // 496 (Ink sheet lower inner frame)

function traceQuadPoints(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  steps = 14,
): void {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const px = inv * inv * x0 + 2 * inv * t * cx + t * t * x1;
    const py = inv * inv * y0 + 2 * inv * t * cy + t * t * y1;
    g.lineTo(px, py);
  }
}

function drawPlatformPilings(
  g: Phaser.GameObjects.Graphics,
  segments: readonly PathSegment[],
  style: 'timber' | 'masonry',
): void {
  const slabH = 16;

  for (const seg of segments) {
    if (seg.layer !== 'ink') continue;
    const leftX = Math.min(seg.a.x, seg.b.x);
    const rightX = Math.max(seg.a.x, seg.b.x);
    const width = rightX - leftX;
    if (width < 40) continue;

    // Vertical support pillars stopping just above the sheet bottom frame
    const pillarPositions =
      width > 190 ? [leftX + 26, rightX - 26] : [leftX + width * 0.5];

    for (const px of pillarPositions) {
      const t = (px - seg.a.x) / Math.max(1, seg.b.x - seg.a.x);
      const topY = seg.a.y + (seg.b.y - seg.a.y) * t + slabH;
      const maxBottomY = Math.min(SHEET_BOTTOM_Y - 12, topY + 140);
      if (maxBottomY - topY < 20) continue;

      if (style === 'masonry') {
        g.fillStyle(PRINT_PALETTE.sepia, 0.08);
        g.fillRect(px - 10, topY, 20, maxBottomY - topY);
        g.lineStyle(1.1, PRINT_PALETTE.charcoal, 0.14);
        g.lineBetween(px - 10, topY, px - 10, maxBottomY);
        g.lineBetween(px + 10, topY, px + 10, maxBottomY);
        for (let y = topY + 22; y < maxBottomY - 6; y += 24) {
          g.lineBetween(px - 10, y, px + 10, y);
        }
        // Tapered stone foot
        g.lineBetween(px - 14, maxBottomY, px + 14, maxBottomY);
      } else {
        // Woodcut timber post with diagonal cross-brace
        g.fillStyle(PRINT_PALETTE.sepia, 0.09);
        g.fillRect(px - 5, topY, 10, maxBottomY - topY);
        g.lineStyle(1.1, PRINT_PALETTE.charcoal, 0.15);
        g.strokeRect(px - 5, topY, 10, maxBottomY - topY);
        // Timber bracket corbel beneath platform
        g.lineBetween(px - 5, topY + 18, px - 18, topY);
        g.lineBetween(px + 5, topY + 18, px + 18, topY);
      }
    }
  }
}

function drawArch(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  baseY: number,
  radius: number,
  pillarHeight: number,
  alpha = 0.12,
): void {
  g.lineStyle(1.3, PRINT_PALETTE.charcoal, alpha);
  g.strokeCircle(cx, baseY - pillarHeight, radius);
  // Clip visually by drawing soft background tone over bottom half of arch? No—draw arc directly!
  g.beginPath();
  g.arc(cx, baseY - pillarHeight, radius, Math.PI, Math.PI * 2);
  g.strokePath();
  g.lineBetween(cx - radius, baseY - pillarHeight, cx - radius, baseY);
  g.lineBetween(cx + radius, baseY - pillarHeight, cx + radius, baseY);
}

function drawWorkshopShelfMotif(g: Phaser.GameObjects.Graphics): void {
  // Subtle left-side printmaker desk shelf with inkwell & rolled scroll etching
  const sx = 125;
  const sy = 165;
  g.lineStyle(1.2, PRINT_PALETTE.charcoal, 0.14);
  g.lineBetween(sx - 45, sy, sx + 55, sy);
  g.lineBetween(sx - 35, sy, sx - 35, sy + 12);
  g.lineBetween(sx + 42, sy, sx + 42, sy + 12);

  // Small ink bottle silhouette
  g.fillStyle(PRINT_PALETTE.cobalt, 0.08);
  g.fillRoundedRect(sx - 24, sy - 22, 18, 22, 3);
  g.strokeRoundedRect(sx - 24, sy - 22, 18, 22, 3);
  g.strokeRect(sx - 19, sy - 27, 8, 5);

  // Rolled paper cylinder
  g.strokeCircle(sx + 18, sy - 9, 9);
  g.lineBetween(sx + 18, sy - 18, sx + 44, sy - 18);
  g.lineBetween(sx + 18, sy, sx + 44, sy);
  g.strokeEllipse(sx + 44, sy - 9, 6, 18);

  // Welcoming hanging lantern over postbox on right
  const lx = 805;
  const ly = 190;
  g.lineBetween(lx, 56, lx, ly);
  g.fillStyle(PRINT_PALETTE.ochre, 0.12);
  g.fillRoundedRect(lx - 9, ly, 18, 24, 4);
  g.strokeRoundedRect(lx - 9, ly, 18, 24, 4);
}

function drawCalibrationTestMotif(g: Phaser.GameObjects.Graphics): void {
  // Optical registration reticle & vernier millimeter ruler at bottom of sheet
  g.lineStyle(1, PRINT_PALETTE.cobalt, 0.12);
  g.strokeCircle(480, 245, 110);
  g.strokeCircle(480, 245, 165);
  g.lineBetween(300, 245, 660, 245);
  g.lineBetween(480, 95, 480, 420);

  // Vernier tick ruler along bottom margin
  const ry = 468;
  g.lineStyle(1, PRINT_PALETTE.charcoal, 0.16);
  g.lineBetween(120, ry, 840, ry);
  for (let x = 120; x <= 840; x += 24) {
    const major = (x - 120) % 96 === 0;
    g.lineBetween(x, ry, x, ry - (major ? 10 : 5));
  }
}

function drawCanalRipplesMotif(g: Phaser.GameObjects.Graphics): void {
  // Hand-drawn woodcut water ripples in the ink basin beneath the Level 2 gap
  g.lineStyle(1.2, PRINT_PALETTE.cobalt, 0.18);
  for (let row = 0; row < 4; row++) {
    const ry = 438 + row * 12;
    const span = 120 - row * 14;
    const cx = 470;
    g.beginPath();
    for (let x = cx - span; x <= cx + span; x += 8) {
      const wave = Math.sin((x - cx) * 0.11 + row) * 2.2;
      if (x === cx - span) g.moveTo(x, ry + wave);
      else g.lineTo(x, ry + wave);
    }
    g.strokePath();
  }
}

function drawTerraceHillsideMotif(g: Phaser.GameObjects.Graphics): void {
  // Distant woodcut hillside contour & slender cypress silhouettes for Level 3
  g.lineStyle(1.2, PRINT_PALETTE.sepia, 0.14);
  g.beginPath();
  g.moveTo(60, 210);
  traceQuadPoints(g, 60, 210, 230, 155, 420, 205);
  traceQuadPoints(g, 420, 205, 640, 250, 890, 170);
  g.strokePath();

  // Three delicate cypress trees on the distant ridge
  const trees: Array<[number, number, number]> = [
    [185, 174, 34],
    [214, 172, 26],
    [785, 192, 38],
  ];
  g.fillStyle(PRINT_PALETTE.sage, 0.09);
  g.lineStyle(1, PRINT_PALETTE.charcoal, 0.15);
  for (const [tx, ty, th] of trees) {
    g.beginPath();
    g.moveTo(tx, ty - th);
    traceQuadPoints(g, tx, ty - th, tx + 9, ty - th * 0.4, tx + 5, ty, 10);
    g.lineTo(tx - 5, ty);
    traceQuadPoints(g, tx - 5, ty, tx - 9, ty - th * 0.4, tx, ty - th, 10);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }
}

function drawViaductMotif(g: Phaser.GameObjects.Graphics): void {
  // Subtle masonry aqueduct arches behind Level 4's split upper/lower route
  g.lineStyle(1.2, PRINT_PALETTE.charcoal, 0.11);
  for (const ax of [190, 320, 680, 795]) {
    g.beginPath();
    g.arc(ax, 430, 38, Math.PI, Math.PI * 2);
    g.strokePath();
    g.lineBetween(ax - 38, 430, ax - 38, 480);
    g.lineBetween(ax + 38, 430, ax + 38, 480);
  }
  // Faint warning chevron hatching under trap spill
  g.lineStyle(1.1, PRINT_PALETTE.vermilion, 0.16);
  for (let x = 540; x <= 610; x += 14) {
    g.lineBetween(x, 382, x - 8, 394);
  }
}

function drawPrintingPressMotif(g: Phaser.GameObjects.Graphics): void {
  // Overhead drying-line proof sheets & iron press beams for Level 5
  g.lineStyle(1.2, PRINT_PALETTE.charcoal, 0.14);
  g.beginPath();
  g.moveTo(95, 92);
  traceQuadPoints(g, 95, 92, 480, 128, 865, 92, 20);
  g.strokePath();

  // Three hanging dried proof sheets on clothespins
  for (const [hx, hy, tilt] of [
    [180, 102, -0.04],
    [480, 118, 0.02],
    [765, 103, 0.05],
  ] as const) {
    g.fillStyle(PRINT_PALETTE.paperWarm, 0.65);
    g.fillRect(hx - 18, hy, 36, 44);
    g.lineStyle(1.1, PRINT_PALETTE.charcoal, 0.18);
    g.strokeRect(hx - 18, hy, 36, 44);
    g.lineBetween(hx - 11, hy + 12 + tilt * 20, hx + 11, hy + 12);
    g.lineBetween(hx - 11, hy + 21 + tilt * 20, hx + 8, hy + 21);
  }

  // Heavy press rail tracks beneath the moving roller
  for (const obs of [
    { startX: 645, endX: 755, y: 400 },
  ]) {
    g.lineStyle(2, PRINT_PALETTE.charcoal, 0.25);
    g.lineBetween(obs.startX, obs.y, obs.endX, obs.y);
    g.lineStyle(1, PRINT_PALETTE.vermilion, 0.28);
    g.lineBetween(obs.startX, obs.y + 4, obs.endX, obs.y + 4);
  }
}

export function drawLevelIllustration(
  g: Phaser.GameObjects.Graphics,
  level: LevelDefinition,
): void {
  // Architectural pilings & support struts under Ink slabs
  const style = level.number === 2 || level.number === 4 ? 'masonry' : 'timber';
  drawPlatformPilings(g, level.segments, style);

  // Roller rail tracks for any dynamic moving obstacles
  for (const obs of level.movingObstacles) {
    g.lineStyle(2, PRINT_PALETTE.charcoal, 0.22);
    g.lineBetween(
      obs.startLocal.x - 10,
      obs.startLocal.y + obs.radius,
      obs.endLocal.x + 10,
      obs.endLocal.y + obs.radius,
    );
  }

  // Bespoke woodcut background motif per level
  switch (level.number) {
    case 0:
      drawCalibrationTestMotif(g);
      break;
    case 1:
      drawWorkshopShelfMotif(g);
      break;
    case 2:
      drawCanalRipplesMotif(g);
      break;
    case 3:
      drawTerraceHillsideMotif(g);
      break;
    case 4:
      drawViaductMotif(g);
      break;
    case 5:
      drawPrintingPressMotif(g);
      break;
    default:
      drawArch(g, 480, SHEET_BOTTOM_Y - 12, 65, 110, 0.08);
      break;
  }
}
