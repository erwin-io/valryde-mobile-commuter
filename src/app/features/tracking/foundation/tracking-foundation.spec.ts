import { FakeClock } from './clock';
import { interpolatePosition, LatestOperation, sampleAnimation } from './animation';
import { commuterVehiclePresentation } from './commuter-vehicle-presentation';
import {
  SYNTHETIC_EMPTY_OBSERVATIONS,
  SYNTHETIC_INVALID_OBSERVATION,
  SYNTHETIC_OUT_OF_ORDER_OBSERVATIONS,
  SYNTHETIC_STALE_OBSERVATION,
  syntheticVehiclePresentation,
} from '../../../../testing/tracking-synthetic-fixtures';

describe('tracking consumer foundation', () => {
  it('uses a deterministic clock without timers or wall-clock access', () => {
    const clock = new FakeClock(1_000);
    clock.advance(250);
    expect(clock.now()).toBe(1_250);
    clock.set(2_000);
    expect(clock.now()).toBe(2_000);
    expect(() => clock.advance(-1)).toThrow(RangeError);
    expect(() => clock.set(Number.NaN)).toThrow(RangeError);
  });

  it('samples only between received endpoints and never extrapolates', () => {
    expect(sampleAnimation(900, 1_000, 500)).toEqual({ progress: 0, done: false });
    expect(sampleAnimation(1_250, 1_000, 500)).toEqual({ progress: 0.5, done: false });
    expect(sampleAnimation(1_900, 1_000, 500)).toEqual({ progress: 1, done: true });
    expect(interpolatePosition([123.8, 10.3], [124, 10.5], -2)).toEqual([123.8, 10.3]);
    expect(interpolatePosition([123.8, 10.3], [124, 10.5], 2)).toEqual([124, 10.5]);
    expect(() => interpolatePosition([Number.NaN, 10.3], [124, 10.5], 0.5)).toThrow(RangeError);
  });

  it('invalidates late callbacks after replacement or component cleanup', () => {
    const operation = new LatestOperation();
    const first = operation.begin();
    const second = operation.begin();
    expect(operation.isCurrent(first)).toBe(false);
    expect(operation.isCurrent(second)).toBe(true);
    operation.cancel();
    expect(operation.isCurrent(second)).toBe(false);
  });

  it('copies only commuter-safe presentation fields', () => {
    const unsafeInput = {
      ...syntheticVehiclePresentation,
      driverName: 'Synthetic Driver',
      driverPhone: '+000000000',
      operatorName: 'Synthetic Operator',
      operatorContact: 'private@example.invalid',
    };
    const output = commuterVehiclePresentation(unsafeInput);
    expect(Object.keys(output).sort()).toEqual([
      'directionLabel',
      'lastUpdatedLabel',
      'plateNumber',
      'position',
      'routeLabel',
      'statusLabel',
      'vehicleColor',
    ]);
    expect(JSON.stringify(output)).not.toMatch(/driver|operator|phone|contact/i);
  });

  it('keeps edge-case fixtures explicitly synthetic and contract-neutral', () => {
    expect(SYNTHETIC_EMPTY_OBSERVATIONS).toEqual([]);
    expect(SYNTHETIC_STALE_OBSERVATION.synthetic).toBe(true);
    expect(SYNTHETIC_INVALID_OBSERVATION.validity).toBe('invalid');
    expect(SYNTHETIC_OUT_OF_ORDER_OBSERVATIONS[1].capturedAtMs).toBeLessThan(
      SYNTHETIC_OUT_OF_ORDER_OBSERVATIONS[0].capturedAtMs,
    );
  });
});
