export interface CapacitySeed {
  staffId: string;
  availableHours: number;
  version?: number;
}
export interface CapacityState {
  staffId: string;
  totalHours: number;
  reservedHours: number;
  availableHours: number;
  version: number;
}

export type CapacityReservationResult =
  | { ok: true; reservationId: string; newVersion: number }
  | {
      ok: false;
      reason: "version_conflict" | "insufficient_hours";
      currentVersion: number;
    };

interface Reservation {
  id: string;
  staffId: string;
  hours: number;
  released: boolean;
}

function validHours(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function createCapacityReservationStore(initial: CapacitySeed[]) {
  const states = new Map<string, CapacityState>();
  const reservations = new Map<string, Reservation>();

  function reset(next: CapacitySeed[]) {
    states.clear();
    reservations.clear();
    for (const seed of [...next].sort((a, b) => a.staffId.localeCompare(b.staffId))) {
      if (states.has(seed.staffId)) throw new Error(`Duplicate capacity seed for ${seed.staffId}`);
      if (!validHours(seed.availableHours)) {
        throw new Error(`Capacity for ${seed.staffId} must be greater than zero`);
      }
      states.set(seed.staffId, {
        staffId: seed.staffId,
        totalHours: seed.availableHours,
        reservedHours: 0,
        availableHours: seed.availableHours,
        version: seed.version ?? 1,
      });
    }
  }

  function getCapacityState(staffId: string): CapacityState {
    const state = states.get(staffId);
    if (!state) throw new Error(`Capacity is not initialized for ${staffId}`);
    return { ...state };
  }

  function reserveCapacity(input: {
    staffId: string;
    hours: number;
    taskId: string;
    version: number;
  }): CapacityReservationResult {
    const state = states.get(input.staffId);
    if (!state || state.version !== input.version) {
      return {
        ok: false,
        reason: "version_conflict",
        currentVersion: state?.version ?? 0,
      };
    }
    if (!validHours(input.hours) || input.hours > state.availableHours) {
      return { ok: false, reason: "insufficient_hours", currentVersion: state.version };
    }

    state.reservedHours += input.hours;
    state.availableHours -= input.hours;
    state.version += 1;
    const reservationId = `${input.staffId}:${input.taskId}:v${state.version}`;
    reservations.set(reservationId, {
      id: reservationId,
      staffId: input.staffId,
      hours: input.hours,
      released: false,
    });
    return { ok: true, reservationId, newVersion: state.version };
  }

  function releaseReservation(reservationId: string): void {
    const reservation = reservations.get(reservationId);
    if (!reservation || reservation.released) return;
    const state = states.get(reservation.staffId);
    if (!state) return;
    state.reservedHours -= reservation.hours;
    state.availableHours += reservation.hours;
    state.version += 1;
    reservation.released = true;
  }

  reset(initial);
  return { getCapacityState, reserveCapacity, releaseReservation, reset };
}

let defaultStore = createCapacityReservationStore([]);

export function resetCapacityReservations(initial: CapacitySeed[]) {
  defaultStore = createCapacityReservationStore(initial);
}

export function getCapacityState(staffId: string) {
  return defaultStore.getCapacityState(staffId);
}

export function reserveCapacity(input: {
  staffId: string;
  hours: number;
  taskId: string;
  version: number;
}) {
  return defaultStore.reserveCapacity(input);
}

export function releaseReservation(reservationId: string): void {
  defaultStore.releaseReservation(reservationId);
}
