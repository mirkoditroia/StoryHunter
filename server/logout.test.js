import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const answers = { q1: "A", q2: "B", q3: "C", q4: "D", q5: "A" };

async function loadStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "storyhunter-profile-"));
  process.env.STORYHUNTER_DATA = dir;
  const store = await import(`./store.js?data=${encodeURIComponent(dir)}`);
  return { dir, store };
}

test("dopo il logout un nome nuovo non viene sostituito da quello del libro precedente", async () => {
  const { dir, store } = await loadStore();
  try {
    const profile = await store.createProfile({ name: "Tiziano", age: 34, gender: "M", answers });
    const book = store.createBook({ name: "Tiziano", age: 34, gender: "M", answers, total_days: 3 });
    book.profile_id = profile.id;
    await store.saveBook(book);

    assert.equal((await store.ensureProfile()).name, "Tiziano");
    await store.logoutProfile();
    assert.equal(await store.ensureProfile(), null);

    const registration = { name: "Chiara", age: 29, gender: "F", answers, total_days: 3 };
    const session = await store.ensureProfile();
    const source = session
      ? {
          name: session.name,
          age: session.age,
          gender: session.gender,
          answers: session.answers,
          total_days: registration.total_days,
        }
      : registration;
    const created = store.createBook(source);
    assert.equal(created.book_config.protagonist.name, "Chiara");
  } finally {
    delete process.env.STORYHUNTER_DATA;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
