import { CommuterVehiclePresentation } from '../app/features/tracking/foundation/commuter-vehicle-presentation';
import { LngLat } from '../app/features/map/location.service';

/** Test-only local observation shape. It is not an Agent B DTO or wire-format proposal. */
export interface SyntheticObservation {
  readonly synthetic: true;
  readonly capturedAtMs: number;
  readonly position: LngLat | null;
  readonly validity: 'valid' | 'invalid';
}

export const SYNTHETIC_EMPTY_OBSERVATIONS: readonly SyntheticObservation[] = [];

export const SYNTHETIC_STALE_OBSERVATION: SyntheticObservation = {
  synthetic: true,
  capturedAtMs: 1_000,
  position: [123.89, 10.31],
  validity: 'valid',
};

export const SYNTHETIC_INVALID_OBSERVATION: SyntheticObservation = {
  synthetic: true,
  capturedAtMs: 2_000,
  position: null,
  validity: 'invalid',
};

export const SYNTHETIC_OUT_OF_ORDER_OBSERVATIONS: readonly SyntheticObservation[] = [
  { synthetic: true, capturedAtMs: 3_000, position: [123.9, 10.32], validity: 'valid' },
  { synthetic: true, capturedAtMs: 2_500, position: [123.895, 10.315], validity: 'valid' },
];

export const syntheticVehiclePresentation: CommuterVehiclePresentation = {
  position: [123.89, 10.31],
  plateNumber: 'SYN-0000',
  routeLabel: 'Synthetic route',
  directionLabel: 'Synthetic direction',
  vehicleColor: '#5E6B65',
  statusLabel: 'Synthetic status',
  lastUpdatedLabel: 'Synthetic update time',
};
