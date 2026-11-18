import type { Vec2 } from '../types';

export type InputDeviceType = 'mouse' | 'touch';

export type InputAction =
  | { type: 'drag_start'; device: InputDeviceType; pointerId: number; point: Vec2 }
  | { type: 'drag_move'; device: InputDeviceType; pointerId: number; delta: Vec2; point: Vec2 }
  | { type: 'drag_end'; device: InputDeviceType; pointerId: number }
  | { type: 'drag_cancel'; pointerId: number | null }
  | { type: 'pause' }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'mute' }
  | { type: 'nudge'; delta: Vec2 };

export class InputController {
  private activePointerId: number | null = null;
  private activeDevice: InputDeviceType | null = null;
  private dragStartPoint: Vec2 | null = null;
  private lastPoint: Vec2 | null = null;
  private isDragging = false;
  private readonly maxDeltaPerEvent: number;

  constructor(maxDeltaPerEvent = 160) {
    this.maxDeltaPerEvent = maxDeltaPerEvent;
  }

  public getState(): {
    isDragging: boolean;
    activePointerId: number | null;
    activeDevice: InputDeviceType | null;
  } {
    return {
      isDragging: this.isDragging,
      activePointerId: this.activePointerId,
      activeDevice: this.activeDevice,
    };
  }

  public pointerDown(
    pointerId: number,
    point: Vec2,
    device: InputDeviceType,
  ): InputAction | null {
    // Multi-touch protection: ignore secondary pointers while one drag is active
    if (this.activePointerId !== null && this.activePointerId !== pointerId) {
      return null;
    }

    this.activePointerId = pointerId;
    this.activeDevice = device;
    this.dragStartPoint = { x: point.x, y: point.y };
    this.lastPoint = { x: point.x, y: point.y };
    this.isDragging = true;

    return {
      type: 'drag_start',
      device,
      pointerId,
      point: { x: point.x, y: point.y },
    };
  }

  public pointerMove(pointerId: number, point: Vec2): InputAction | null {
    if (!this.isDragging || this.activePointerId !== pointerId || !this.lastPoint || !this.activeDevice) {
      return null;
    }

    const rawDx = point.x - this.lastPoint.x;
    const rawDy = point.y - this.lastPoint.y;

    const dx = Math.max(-this.maxDeltaPerEvent, Math.min(this.maxDeltaPerEvent, rawDx));
    const dy = Math.max(-this.maxDeltaPerEvent, Math.min(this.maxDeltaPerEvent, rawDy));

    this.lastPoint = { x: point.x, y: point.y };

    return {
      type: 'drag_move',
      device: this.activeDevice,
      pointerId,
      delta: { x: dx, y: dy },
      point: { x: point.x, y: point.y },
    };
  }

  public pointerUp(pointerId: number): InputAction | null {
    if (!this.isDragging || this.activePointerId !== pointerId || !this.activeDevice) {
      return null;
    }

    const device = this.activeDevice;
    this.resetPointer();
    return {
      type: 'drag_end',
      device,
      pointerId,
    };
  }

  public pointerCancel(pointerId: number | null = null): InputAction | null {
    if (!this.isDragging) {
      return null;
    }
    if (pointerId !== null && this.activePointerId !== pointerId) {
      return null;
    }
    const cancelledId = this.activePointerId;
    this.resetPointer();
    return {
      type: 'drag_cancel',
      pointerId: cancelledId,
    };
  }

  public handleKeyDown(key: string): InputAction | null {
    const normalized = key.toLowerCase();
    if (normalized === 'escape' || normalized === 'p') {
      return { type: 'pause' };
    }
    if (normalized === 'z' || normalized === 'backspace' || normalized === 'u') {
      return { type: 'undo' };
    }
    if (normalized === 'r') {
      return { type: 'reset' };
    }
    if (normalized === 'm') {
      return { type: 'mute' };
    }
    if (normalized === 'arrowleft' || normalized === 'a') {
      return { type: 'nudge', delta: { x: -12, y: 0 } };
    }
    if (normalized === 'arrowright' || normalized === 'd') {
      return { type: 'nudge', delta: { x: 12, y: 0 } };
    }
    if (normalized === 'arrowup' || normalized === 'w') {
      return { type: 'nudge', delta: { x: 0, y: -12 } };
    }
    if (normalized === 'arrowdown' || normalized === 's') {
      return { type: 'nudge', delta: { x: 0, y: 12 } };
    }
    return null;
  }

  private resetPointer(): void {
    this.activePointerId = null;
    this.activeDevice = null;
    this.dragStartPoint = null;
    this.lastPoint = null;
    this.isDragging = false;
  }
}
