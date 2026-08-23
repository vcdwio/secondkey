import assert from "node:assert/strict";
import test from "node:test";

import {
  createCapacityReservationStore,
  getCapacityState,
  releaseReservation,
  reserveCapacity,
  resetCapacityReservations,
} from "../lib/contextops/capacity.ts";

test("two callers using one staff version produce one reservation and one conflict", async () => {
  const store = createCapacityReservationStore([{ staffId: "VC-007", availableHours: 4 }]);
  const version = store.getCapacityState("VC-007").version;

  const [left, right] = await Promise.all([
    Promise.resolve().then(() => store.reserveCapacity({ staffId: "VC-007", hours: 4, taskId: "TASK-A", version })),
    Promise.resolve().then(() => store.reserveCapacity({ staffId: "VC-007", hours: 4, taskId: "TASK-B", version })),
  ]);

  assert.equal([left, right].filter((result) => result.ok).length, 1);
  assert.deepEqual(
    [left, right].filter((result) => !result.ok).map((result) => result.reason),
    ["version_conflict"],
  );
  assert.equal(store.getCapacityState("VC-007").reservedHours, 4);
});

test("a conflicted caller can reread and receives the honest remaining-capacity result", () => {
  const store = createCapacityReservationStore([{ staffId: "VC-007", availableHours: 6 }]);
  const staleVersion = store.getCapacityState("VC-007").version;
  assert.equal(store.reserveCapacity({ staffId: "VC-007", hours: 4, taskId: "TASK-A", version: staleVersion }).ok, true);

  const conflict = store.reserveCapacity({ staffId: "VC-007", hours: 3, taskId: "TASK-B", version: staleVersion });
  assert.deepEqual(conflict, { ok: false, reason: "version_conflict", currentVersion: 2 });

  const currentVersion = store.getCapacityState("VC-007").version;
  const retry = store.reserveCapacity({ staffId: "VC-007", hours: 3, taskId: "TASK-B", version: currentVersion });
  assert.deepEqual(retry, { ok: false, reason: "insufficient_hours", currentVersion: 2 });
});

test("1,000 seeded competing reservations never exceed staff capacity", async () => {
  let seed = 0x5eed1234;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };

  for (let run = 0; run < 1_000; run += 1) {
    const total = 2 + Math.floor(random() * 15);
    const leftHours = 1 + Math.floor(random() * total);
    const rightHours = 1 + Math.floor(random() * total);
    const store = createCapacityReservationStore([{ staffId: "VC-009", availableHours: total }]);
    const version = store.getCapacityState("VC-009").version;
    const calls = [
      () => store.reserveCapacity({ staffId: "VC-009", hours: leftHours, taskId: `LEFT-${run}`, version }),
      () => store.reserveCapacity({ staffId: "VC-009", hours: rightHours, taskId: `RIGHT-${run}`, version }),
    ];
    if (random() > 0.5) calls.reverse();

    await Promise.all(calls.map((call) => Promise.resolve().then(call)));
    const state = store.getCapacityState("VC-009");
    assert.ok(state.reservedHours <= state.totalHours, `run ${run} oversold capacity`);
    assert.ok(state.availableHours >= 0, `run ${run} produced negative availability`);
  }
});

test("release restores hours, advances the version, and is idempotent", () => {
  const store = createCapacityReservationStore([{ staffId: "VC-010", availableHours: 5 }]);
  const reservation = store.reserveCapacity({ staffId: "VC-010", hours: 3, taskId: "TASK-EL", version: 1 });
  assert.equal(reservation.ok, true);
  if (!reservation.ok) return;

  store.releaseReservation(reservation.reservationId);
  assert.deepEqual(store.getCapacityState("VC-010"), {
    staffId: "VC-010",
    totalHours: 5,
    reservedHours: 0,
    availableHours: 5,
    version: 3,
  });
  store.releaseReservation(reservation.reservationId);
  assert.equal(store.getCapacityState("VC-010").version, 3);
});

test("top-level reset clears earlier reservations and restores version one", () => {
  resetCapacityReservations([{ staffId: "VC-008", availableHours: 4 }]);
  const reserved = reserveCapacity({ staffId: "VC-008", hours: 2, taskId: "TASK-MH", version: 1 });
  assert.equal(reserved.ok, true);

  resetCapacityReservations([{ staffId: "VC-008", availableHours: 3 }]);
  assert.deepEqual(getCapacityState("VC-008"), {
    staffId: "VC-008",
    totalHours: 3,
    reservedHours: 0,
    availableHours: 3,
    version: 1,
  });
  if (reserved.ok) releaseReservation(reserved.reservationId);
  assert.equal(getCapacityState("VC-008").availableHours, 3);
});
