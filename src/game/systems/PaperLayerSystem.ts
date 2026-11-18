import type { LevelDefinition, PaperLayerId, RectBounds, Vec2 } from '../types';

export interface SheetRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const INK_SHEET_RECT: SheetRect = { x: 40, y: 44, width: 880, height: 452 };
export const GHOST_SHEET_RECT: SheetRect = { x: 200, y: 95, width: 560, height: 370 };

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function clampLayerOffset(offset: Vec2, bounds: RectBounds): Vec2 {
  return {
    x: clamp(offset.x, bounds.minX, bounds.maxX),
    y: clamp(offset.y, bounds.minY, bounds.maxY),
  };
}

export function isLayerMovable(bounds: RectBounds): boolean {
  return bounds.maxX > bounds.minX || bounds.maxY > bounds.minY;
}

export interface WorldLayoutMetrics {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly topSafe: number;
  readonly bottomSafe: number;
  readonly leftSafe: number;
  readonly rightSafe: number;
}

export function computeWorldLayout(
  viewW: number,
  viewH: number,
  worldW: number,
  worldH: number,
  isGameplayActive: boolean,
): WorldLayoutMetrics {
  const safeViewW = Math.max(240, viewW);
  const safeViewH = Math.max(240, viewH);
  const isPortrait = safeViewH > safeViewW;
  const isCompactLandscape = !isPortrait && safeViewH < 520;
  const isTitleDesktop = !isGameplayActive && safeViewW >= 1024 && safeViewH >= 560;

  let topSafe = 48;
  let bottomSafe = 48;
  let leftSafe = 32;
  let rightSafe = 32;

  if (isGameplayActive) {
    if (isPortrait) {
      topSafe = clamp(Math.round(safeViewH * 0.175), 136, 168);
      bottomSafe = 68;
      leftSafe = 12;
      rightSafe = 12;
    } else if (isCompactLandscape) {
      topSafe = 78;
      bottomSafe = 54;
      leftSafe = 24;
      rightSafe = 24;
    } else {
      topSafe = 92;
      bottomSafe = 58;
      leftSafe = 36;
      rightSafe = 36;
    }
  } else if (isTitleDesktop) {
    leftSafe = 420;
    rightSafe = 48;
    topSafe = 48;
    bottomSafe = 56;
  } else if (isPortrait) {
    topSafe = 24;
    bottomSafe = clamp(Math.round(safeViewH * 0.43), 240, 380);
    leftSafe = 14;
    rightSafe = 14;
  } else {
    leftSafe = clamp(Math.round(safeViewW * 0.42), 280, 380);
    rightSafe = 20;
    topSafe = 24;
    bottomSafe = 28;
  }

  const availW = Math.max(160, safeViewW - leftSafe - rightSafe);
  const availH = Math.max(160, safeViewH - topSafe - bottomSafe);
  const scale = Math.min(availW / worldW, availH / worldH);
  const offsetX = leftSafe + (availW - worldW * scale) * 0.5;
  const offsetY = topSafe + (availH - worldH * scale) * 0.5;

  return {
    scale,
    offsetX,
    offsetY,
    topSafe,
    bottomSafe,
    leftSafe,
    rightSafe,
  };
}

export function isPointInsideSheet(
  worldPos: Vec2,
  sheetRect: SheetRect,
  layerOffset: Vec2,
  margin = 0,
): boolean {
  const minX = sheetRect.x + layerOffset.x - margin;
  const minY = sheetRect.y + layerOffset.y - margin;
  return (
    worldPos.x >= minX &&
    worldPos.x <= minX + sheetRect.width + margin * 2 &&
    worldPos.y >= minY &&
    worldPos.y <= minY + sheetRect.height + margin * 2
  );
}

export function resolveDragLayerAtPoint(
  worldPos: Vec2,
  level: LevelDefinition,
  inkOffset: Vec2,
  ghostOffset: Vec2,
  forceInk = false,
  touchMarginPx = 0,
): PaperLayerId {
  const inkMovable = isLayerMovable(level.inkBounds);
  const ghostMovable = isLayerMovable(level.ghostBounds);

  if (forceInk && inkMovable) {
    return 'ink';
  }
  if (ghostMovable && isPointInsideSheet(worldPos, GHOST_SHEET_RECT, ghostOffset, touchMarginPx)) {
    return 'ghost';
  }
  if (inkMovable && isPointInsideSheet(worldPos, INK_SHEET_RECT, inkOffset, touchMarginPx)) {
    return 'ink';
  }
  return ghostMovable ? 'ghost' : 'ink';
}

export function localToWorld(localPos: Vec2, layerOffset: Vec2): Vec2 {
  return {
    x: localPos.x + layerOffset.x,
    y: localPos.y + layerOffset.y,
  };
}

export function worldToLocal(worldPos: Vec2, layerOffset: Vec2): Vec2 {
  return {
    x: worldPos.x - layerOffset.x,
    y: worldPos.y - layerOffset.y,
  };
}

export function relativeLayerDelta(inkOffset: Vec2, ghostOffset: Vec2): Vec2 {
  return {
    x: ghostOffset.x - inkOffset.x,
    y: ghostOffset.y - inkOffset.y,
  };
}

export function ghostLocalToInkLocal(
  ghostLocalPos: Vec2,
  inkOffset: Vec2,
  ghostOffset: Vec2,
): Vec2 {
  return {
    x: ghostLocalPos.x + ghostOffset.x - inkOffset.x,
    y: ghostLocalPos.y + ghostOffset.y - inkOffset.y,
  };
}

export function inkLocalToGhostLocal(
  inkLocalPos: Vec2,
  inkOffset: Vec2,
  ghostOffset: Vec2,
): Vec2 {
  return {
    x: inkLocalPos.x + inkOffset.x - ghostOffset.x,
    y: inkLocalPos.y + inkOffset.y - ghostOffset.y,
  };
}

export function layerLocalToInkLocal(
  localPos: Vec2,
  layer: PaperLayerId,
  inkOffset: Vec2,
  ghostOffset: Vec2,
): Vec2 {
  if (layer === 'ink') {
    return localPos;
  }
  return ghostLocalToInkLocal(localPos, inkOffset, ghostOffset);
}
