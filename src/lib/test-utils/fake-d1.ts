// node:sqlite (Node 22.5+, built-in) uzerinde ince bir katman - Cloudflare D1Database'in
// prepare(sql).bind(...args).run()/.first()/.all() zincirini birebir taklit eder. Yalnizca
// vitest testleri icin: gercek D1'e baglanmadan, gercek SQLite SQL semantigiyle (UNIQUE/CHECK
// kisitlari, transaction'lar dahil) sync.ts/payments/db.ts gibi D1-bagimli kodu test etmeyi
// saglar - hicbir production kod yolu bu dosyayi import etmez.
// Vite'in test ortamındaki module runner'ı "node:sqlite" gibi yeni/deneysel built-in'leri
// tanımıyor - hem statik hem @vite-ignore'lu dynamic import kendi çözümleyicisinden geçiyor ve
// "sqlite" (node: öneki düşmüş) bare specifier olarak başarısız oluyor. createRequire, Vite'in
// modül grafiğini tamamen atlayıp gerçek Node CJS require'ına düşer (yalnızca test kodu).
import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export interface FakeD1 {
  prepare(sql: string): FakeD1Statement;
  exec(sql: string): void;
  close(): void;
}

export interface FakeD1Statement {
  bind(...args: unknown[]): FakeD1BoundStatement;
  run(): Promise<{ success: true; meta: { changes: number; last_row_id: number } }>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}

export type FakeD1BoundStatement = FakeD1Statement;

// node:sqlite'ın SQLInputValue tipi (string|number|bigint|Buffer|null) dar - bind() D1 gibi
// gelişigüzel değer kabul ediyormuş gibi davranmalı (test kodu bunu her zaman doğru tipte
// çağırır), bu yüzden burada bilerek `any` ile SQLite'ın kendi runtime tip kontrolüne bırakılıyor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeArgs(args: unknown[]): any[] {
  // D1/better-sqlite tarzı: undefined -> null (SQLite undefined kabul etmez)
  return args.map((value) => (value === undefined ? null : value));
}

export function createFakeD1(schemaSql: string): FakeD1 {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON;");
  raw.exec(schemaSql);

  function makeStatement(sql: string, boundArgs: unknown[]): FakeD1Statement {
    return {
      bind(...args: unknown[]) {
        return makeStatement(sql, args);
      },
      async run() {
        const stmt = raw.prepare(sql);
        const info = stmt.run(...normalizeArgs(boundArgs));
        return {
          success: true,
          meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
        };
      },
      async first<T>() {
        const stmt = raw.prepare(sql);
        const row = stmt.get(...normalizeArgs(boundArgs));
        return (row as T) ?? null;
      },
      async all<T>() {
        const stmt = raw.prepare(sql);
        const rows = stmt.all(...normalizeArgs(boundArgs));
        return { results: rows as T[] };
      },
    };
  }

  return {
    prepare(sql: string) {
      return makeStatement(sql, []);
    },
    exec(sql: string) {
      raw.exec(sql);
    },
    close() {
      raw.close();
    },
  };
}
