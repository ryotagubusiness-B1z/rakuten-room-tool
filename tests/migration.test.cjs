const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("const STORE_KEY=");
const end = html.indexOf("/* =====================  レンダリング", start);
assert.ok(start >= 0 && end > start, "移行コードをindex.htmlから取得できること");

const oldState = {pool:{item1:{
  product:{name:"【45％OFFクーポン】日傘 日傘 超軽量 完全遮光", genre:"ファッション"},
  selected:true,
  tone:"oshi",
  intro:"【これはチェックしたい】【45％OFFクーポン】日傘 日傘",
  introVersion:4,
  tags:{"【45％OFFクーポン】":true,"日傘":true}
}}};
const storage = new Map([["rakuten_room_tool_v1", JSON.stringify(oldState)]]);
const context = {
  localStorage:{
    getItem:key => storage.get(key) || null,
    setItem:(key,value) => storage.set(key,value)
  }
};
vm.createContext(context);
vm.runInContext(`${html.slice(start, end)}\nthis.result=state;`, context);

const migrated = context.result.pool.item1;
assert.equal(migrated.introVersion, 6);
assert.equal(migrated.tagVersion, 3);
assert.equal(/クーポン|OFF/.test(migrated.intro), false);
assert.equal((migrated.intro.match(/日傘/g) || []).length, 1);
assert.deepEqual(Object.keys(migrated.tags), []);

const persisted = JSON.parse(storage.get("rakuten_room_tool_v1")).pool.item1;
assert.equal(persisted.introVersion, 6, "移行結果をlocalStorageへ保存する");
assert.equal(persisted.tagVersion, 3, "タグ移行結果をlocalStorageへ保存する");
console.log("migration: all tests passed");
