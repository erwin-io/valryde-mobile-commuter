import { LngLat } from '../../map/location.service';

export interface AnimationSample {
  progress: number;
  done: boolean;
}

/**
 * Returns a bounded progress value for animation between two observations already received.
 * It never extrapolates beyond either endpoint and does not predict a future position.
 */
export function sampleAnimation(nowMs: number, startedAtMs: number, durationMs: number): AnimationSample {
  if (![nowMs, startedAtMs, durationMs].every(Number.isFinite) || durationMs < 0) {
    throw new RangeError('Animation times must be finite and duration must be non-negative.');
  }
  if (durationMs === 0) return { progress: 1, done: true };
  const progress = Math.max(0, Math.min(1, (nowMs - startedAtMs) / durationMs));
  return { progress, done: progress === 1 };
}

/** Linear visual interpolation between two received valid fixes; progress is clamped defensively. */
export function interpolatePosition(from: LngLat, to: LngLat, progress: number): LngLat {
  if (!Number.isFinite(progress) || !validPosition(from) || !validPosition(to)) {
    throw new RangeError('Animation progress and received positions must be valid.');
  }
  const bounded = Math.max(0, Math.min(1, progress));
  return [from[0] + (to[0] - from[0]) * bounded, from[1] + (to[1] - from[1]) * bounded];
}

function validPosition(position: LngLat): boolean {
  return (
    Number.isFinite(position[0]) &&
    Number.isFinite(position[1]) &&
    position[0] >= -180 &&
    position[0] <= 180 &&
    position[1] >= -90 &&
    position[1] <= 90
  );
}

/** Generation token used by components to reject late async/animation callbacks after replacement or cleanup. */
export class LatestOperation {
  private generation = 0;

  begin(): number {
    return ++this.generation;
  }

  isCurrent(token: number): boolean {
    return token === this.generation;
  }

  cancel(): void {
    this.generation++;
  }
}
