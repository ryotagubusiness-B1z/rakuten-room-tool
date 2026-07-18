const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("const STORE_KEY=");
const end = html.indexOf("/* =====================  レンダリング", start);
assert.ok(start >= 0 && end > start, "移行コードをindex.htmlから取得できること");

const oldState = {pool:{
  item1:{
    product:{name:"【45％OFFクーポン】日傘 日傘 超軽量 完全遮光", genre:"ファッション"},
    selected:true,
    tone:"oshi",
    intro:"【これはチェックしたい】【45％OFFクーポン】日傘 日傘 超軽量 完全遮光\n\n気になるアイテムとしてご紹介🤍\n詳しい商品情報は、商品ページでチェックしてみてください。",
    introVersion:4,
    tags:{"【45％OFFクーポン】":true,"日傘":true}
  },
  item2:{
    product:{name:"高保湿 化粧水 セラミド配合", genre:"美容・コスメ"},
    selected:true,
    tone:"polite",
    intro:"乾燥が気になる季節に確認したい化粧水です。",
    introVersion:5,
    tags:{"スキンケア":true,"敏感肌":false,"激安":true}
  },
  item3:{
    product:{name:"ワイヤレスイヤホン ノイズキャンセリング", genre:"家電・ガジェット"},
    selected:true,
    tone:"casual",
    intro:"",
    introVersion:6,
    introEdited:false,
    tags:{},
    tagVersion:3
  },
  item4:{
    product:{name:"CAROTE カローテ 卵焼き フライパン 2点セット", genre:"キッチン・日用品"},
    selected:true,
    tone:"oshi",
    intro:"CAROTEの2点セットを後で比較するために自分で書いたメモです。",
    introVersion:5,
    tags:{"比較用":true},
    tagVersion:2
  },
  item5:{
    product:{name:"激安 CAROTE カローテ 卵焼き フライパン 2点セットが", genre:"キッチン・日用品"},
    selected:true,
    tone:"oshi",
    intro:"注目したいフライパンをピックアップ🤍\n激安・2点セットが・カローテなど、気になるポイントがそろっています。\n詳しくは商品ページでチェックしてみてください。",
    introVersion:5,
    tags:{"激安":true,"CAROTE":true},
    tagVersion:2
  },
  item6:{
    product:{name:"高保湿 化粧水 セラミド", genre:"美容・コスメ"},
    selected:true,
    tone:"polite",
    intro:"化粧水の中から、気になるアイテムをピックアップしました。\n自分で追記したセラミドといった特徴があります。\n詳しい仕様やカラーは、商品ページでご確認ください。",
    introVersion:5,
    tags:{"セラミド":true},
    tagVersion:2
  }
}};
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
assert.equal(migrated.introEdited, false, "自動再生成した紹介文として記録する");
assert.equal(migrated.tags["日傘"], true, "安全な既存タグは維持する");
assert.equal(Object.keys(migrated.tags).some(tag=>/クーポン|OFF/.test(tag)), false, "危険な旧タグだけを除去する");

const manual = context.result.pool.item2;
assert.equal(manual.intro, "乾燥が気になる季節に確認したい化粧水です。", "手編集と考えられる安全な紹介文は上書きしない");
assert.equal(manual.introEdited, true, "保持した旧紹介文を手編集扱いにする");
assert.equal(manual.tags["スキンケア"], true, "選択済みの安全な手動タグを維持する");
assert.equal(manual.tags["敏感肌"], false, "選択解除した安全な手動タグも維持する");
assert.equal("激安" in manual.tags, false, "販促語タグだけを除去する");

const uninitialized = context.result.pool.item3;
assert.ok(Object.keys(uninitialized.tags).length > 0, "現行版でも未初期化タグは執筆画面を経由せず補完する");
assert.equal(Object.values(uninitialized.tags).some(Boolean), true, "補完したタグを投稿用に選択済みにする");

const manualWithUnsafeWords = context.result.pool.item4;
assert.equal(manualWithUnsafeWords.intro, oldState.pool.item4.intro, "旧版で識別不能な手編集メモはブランド名やセット表記を含んでも上書きしない");
assert.equal(manualWithUnsafeWords.introEdited, true, "保持した旧メモを以後の自動移行対象外にする");

const legacyV5 = context.result.pool.item5;
assert.equal(/激安|CAROTE|カローテ|2点セット/.test(legacyV5.intro), false, "v5の既知テンプレートで生成された問題文だけを安全に再生成する");
assert.equal(legacyV5.introEdited, false, "再生成したv5文を自動生成扱いにする");
assert.equal(legacyV5.legacyIntroBackup, oldState.pool.item5.intro, "再生成前のv5文を復元可能な状態で退避する");

const partiallyEdited = context.result.pool.item6;
assert.equal(partiallyEdited.legacyIntroBackup, oldState.pool.item6.intro, "v5テンプレートに似た部分編集文も上書き前に退避する");
assert.notEqual(partiallyEdited.intro, partiallyEdited.legacyIntroBackup, "退避後は安全なv6文へ移行する");
assert.equal(vm.runInContext("restoreLegacyIntro(this.result.pool.item6)", context), true, "移行前の文を復元できる");
assert.equal(partiallyEdited.intro, oldState.pool.item6.intro, "復元操作で退避した部分編集文へ戻す");
assert.equal(partiallyEdited.introEdited, true, "復元後は再移行で上書きしない手編集文として扱う");

const persisted = JSON.parse(storage.get("rakuten_room_tool_v1")).pool.item1;
assert.equal(persisted.introVersion, 6, "移行結果をlocalStorageへ保存する");
assert.equal(persisted.tagVersion, 3, "タグ移行結果をlocalStorageへ保存する");
assert.equal(JSON.parse(storage.get("rakuten_room_tool_v1")).pool.item2.intro, oldState.pool.item2.intro, "手編集文の保持結果をlocalStorageへ保存する");
console.log("migration: all tests passed");
