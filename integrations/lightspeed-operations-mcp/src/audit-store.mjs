import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SAFE_ID = /^[a-f0-9]{64}$/;

export class FileAuditStore {
  constructor(directory) {
    if (!directory) throw new Error("A local audit directory is required for write execution");
    this.directory = directory;
  }

  pathFor(id) {
    if (!SAFE_ID.test(id)) throw new Error("Invalid audit identifier");
    return join(this.directory, `${id}.json`);
  }

  async reserve(record) {
    await mkdir(this.directory, { recursive: true });
    const path = this.pathFor(record.id);
    let handle;
    try {
      handle = await open(path, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`, "utf8");
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new Error("This preview receipt was already used; create a fresh preview");
      }
      throw error;
    } finally {
      await handle?.close();
    }
  }

  async complete(id, fields) {
    const path = this.pathFor(id);
    const current = JSON.parse(await readFile(path, "utf8"));
    const next = { ...current, ...fields, completed_at: new Date().toISOString() };
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }
}

export class MemoryAuditStore {
  constructor() {
    this.rows = new Map();
  }

  async reserve(record) {
    if (this.rows.has(record.id)) throw new Error("This preview receipt was already used; create a fresh preview");
    this.rows.set(record.id, { ...record });
  }

  async complete(id, fields) {
    const current = this.rows.get(id);
    if (!current) throw new Error("Missing audit reservation");
    this.rows.set(id, { ...current, ...fields, completed_at: new Date().toISOString() });
  }
}
