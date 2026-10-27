import test from "node:test";
import assert from "node:assert/strict";
import { inspectDayJson } from "./dayjson.js";
import { samplePayload } from "./sample.js";
import { buildPreset } from "./presets.js";

function rejects(value, pattern) {
  assert.throws(
    () => inspectDayJson(value),
    (error) => {
      assert.equal(error.status, 400);
      assert.match(error.message, pattern);
      return true;
    }
  );
}

test("accetta la giornata cucita e anche solo la telemetria", () => {
  assert.deepEqual(inspectDayJson(samplePayload), { kind: "payload" });
  assert.deepEqual(inspectDayJson(samplePayload.today_unified_telemetry), { kind: "payload" });
  assert.deepEqual(inspectDayJson(JSON.stringify(samplePayload)), { kind: "payload" });
});

test("accetta i quattro slot del merger", () => {
  const slots = buildPreset("empty_day");
  assert.deepEqual(inspectDayJson(slots), { kind: "slots" });
  assert.deepEqual(inspectDayJson({ slots }), { kind: "slots" });
});

test("rifiuta testo che non è JSON, o che non è una giornata", () => {
  rejects("{", /non è un JSON valido/);
  rejects("   ", /vuoto/);
  rejects({ book_config: { current_day: 1 } }, /struttura di una giornata/);
  rejects([{ id: "casa" }], /Nessuno slot riconosciuto/);
});

test("la telemetria vuole scene, un luogo e la chiusura di mezzanotte", () => {
  rejects(
    { today_unified_telemetry: { unified_scenes: [], midnight_cutoff_status: "AT_HOME_RESTING" } },
    /unified_scenes/
  );
  rejects(
    {
      today_unified_telemetry: {
        unified_scenes: [{ time_window: "08:00 - 09:00" }],
        midnight_cutoff_status: "AT_HOME_RESTING",
      },
    },
    /non ha un luogo/
  );
  rejects(
    {
      today_unified_telemetry: {
        unified_scenes: [{ time_window: "08:00 - 09:00", location_alias: "casa" }],
        midnight_cutoff_status: "A_CASA",
      },
    },
    /midnight_cutoff_status/
  );
});
