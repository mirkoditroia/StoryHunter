import test from "node:test";
import assert from "node:assert/strict";
import { answersFromProtagonist, profileFromAnswers } from "./meta.js";
import { visibleBooks } from "./store.js";

test("le risposte si ricostruiscono dal protagonista e viceversa", () => {
  const answers = { q1: "B", q2: "C", q3: "D", q4: "B", q5: "A" };
  const traits = profileFromAnswers(answers);
  assert.deepEqual(answersFromProtagonist({ name: "Mirko", ...traits }), answers);
});

test("un valore che non è una risposta non diventa un profilo", () => {
  assert.equal(answersFromProtagonist({ metaphor_domain: "sconosciuto" }), null);
});

test("senza profilo non si vede nessun libro; con profilo solo i suoi", () => {
  const books = [
    { id: "a", profile_id: "pf_mirko" },
    { id: "b", profile_id: "pf_elena" },
    { id: "c", profile_id: "" },
  ];
  assert.deepEqual(visibleBooks(books, ""), []);
  assert.deepEqual(visibleBooks(books, "pf_mirko").map((book) => book.id), ["a"]);
});
