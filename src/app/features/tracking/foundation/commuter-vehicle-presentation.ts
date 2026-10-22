import { LngLat } from '../../map/location.service';

/**
 * Local rendering state only. This deliberately does not describe a REST or Pusher payload.
 * Driver and operator identity have no place in the commuter presentation boundary.
 */
export interface CommuterVehiclePresentation {
  position: LngLat;
  plateNumber: string;
  routeLabel: string;
  directionLabel: string;
  vehicleColor: string;
  statusLabel: string;
  lastUpdatedLabel: string;
}

/** Explicit allowlist copy prevents incidental upstream properties from reaching commuter rendering. */
export function commuterVehiclePresentation(
  input: CommuterVehiclePresentation,
): CommuterVehiclePresentation {
  return {
    position: [input.position[0], input.position[1]],
    plateNumber: input.plateNumber,
    routeLabel: input.routeLabel,
    directionLabel: input.directionLabel,
    vehicleColor: input.vehicleColor,
    statusLabel: input.statusLabel,
    lastUpdatedLabel: input.lastUpdatedLabel,
  };
}
