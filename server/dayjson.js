import { SLOT_DEFS } from "./meta.js";
import { normalizeSlots } from "./merger.js";
import { HttpError } from "./errors.js";

const SLOT_IDS = SLOT_DEFS.map((slot) => slot.id);

const CUTOFFS = new Set([
  "AT_HOME_RESTING",
  "OUTSIDE_AWAY",
  "OUTSIDE_HIGH_ACTIVITY",
  "OUTSIDE_CLIFFHANGER",
]);

// Due forme, le stesse che il ciclo già conosce:
// la giornata cucita (today_unified_telemetry) oppure i quattro slot del merger.
export function inspectDayJson(input) {
  const value = parseDayJson(input);
  if (isTelemetry(value)) {
    assertDayTelemetry(value.today_unified_telemetry || value);
    return { kind: "payload" };
  }
  if (isSlots(value)) {
    const slots = Array.isArray(value) ? value : value.slots;
    const known = slots.filter((slot) => slot && SLOT_IDS.includes(slot.id));
    if (!known.length) {
      throw new HttpError(
        400,
        "Nessuno slot riconosciuto. Gli id ammessi sono SLOT_1_NIGHT, SLOT_2_MORNING, SLOT_3_AFTERNOON e SLOT_4_EVENING."
      );
    }
    normalizeSlots(known);
    return { kind: "slots" };
  }
  throw new HttpError(
    400,
    "Il JSON non ha la struttura di una giornata. Serve un oggetto con today_unified_telemetry, oppure l'array degli slot."
  );
}

export function assertDayTelemetry(telemetry) {
  if (!telemetry || typeof telemetry !== "object" || Array.isArray(telemetry)) {
    throw new HttpError(400, "Il JSON della giornata deve contenere today_unified_telemetry.");
  }
  if (!Array.isArray(telemetry.unified_scenes) || telemetry.unified_scenes.length === 0) {
    throw new HttpError(400, "today_unified_telemetry.unified_scenes deve essere un elenco di scene, almeno una.");
  }
  telemetry.unified_scenes.forEach((scene, index) => {
    const n = index + 1;
    if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
      throw new HttpError(400, `La scena ${n} non è un oggetto.`);
    }
    if (!String(scene.time_window || "").trim()) {
      throw new HttpError(400, `La scena ${n} non ha time_window.`);
    }
    const place = scene.location_alias || scene.location_at || scene.location_id;
    if (!String(place || "").trim()) {
      throw new HttpError(400, `La scena ${n} non ha un luogo: serve location_alias, location_at o location_id.`);
    }
  });
  if (!CUTOFFS.has(telemetry.midnight_cutoff_status)) {
    throw new HttpError(
      400,
      "midnight_cutoff_status deve essere AT_HOME_RESTING, OUTSIDE_AWAY, OUTSIDE_HIGH_ACTIVITY o OUTSIDE_CLIFFHANGER."
    );
  }
}

function parseDayJson(input) {
  if (typeof input !== "string") return input;
  const text = input.trim();
  if (!text) throw new HttpError(400, "Il JSON della giornata è vuoto.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Questo testo non è un JSON valido.");
  }
}

function isTelemetry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.today_unified_telemetry && typeof value.today_unified_telemetry === "object") return true;
  return Array.isArray(value.unified_scenes);
}

function isSlots(value) {
  if (Array.isArray(value)) return true;
  return Boolean(value && typeof value === "object" && Array.isArray(value.slots));
}
