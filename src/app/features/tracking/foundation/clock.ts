/** Injectable-by-construction time source for deterministic freshness and animation tests. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** Test clock; it has no timers and cannot wake production work accidentally. */
export class FakeClock implements Clock {
  constructor(private value: number) {
    assertFiniteTime(value);
  }

  now(): number {
    return this.value;
  }

  set(value: number): void {
    assertFiniteTime(value);
    this.value = value;
  }

  advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new RangeError('Clock advance must be finite and non-negative.');
    this.value += milliseconds;
  }
}

function assertFiniteTime(value: number): void {
  if (!Number.isFinite(value)) throw new RangeError('Clock time must be finite.');
}
