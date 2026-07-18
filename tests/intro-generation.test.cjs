const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("const PROMO_WORDS=");
const end = html.indexOf("state=loadState();", start);
assert.ok(start >= 0 && end > start, "紹介文生成コードをindex.htmlから取得できること");

const context = {};
vm.createContext(context);
vm.runInContext(`${html.slice(start, end)}\nthis.api={stripPromoText,summarizeProduct,suggestTags,genIntro};`, context);
const {stripPromoText, summarizeProduct, suggestTags, genIntro} = context.api;

const parasol = {
  name: "【今すぐ使える！店内全品45％OFFクーポン】《35％OFFクーポン》【楽天デイリー総合1位】 日傘 日傘 超軽量 日傘形状記憶 日傘折りたたみ 完全遮光 晴雨兼用 レディース UVカット100% 軽量 ワンタッチ 自動開閉 コンパクト 丈夫 遮熱 紫外線100カット 折りたたみ傘 無地",
  genre: "ファッション"
};

assert.equal(stripPromoText(parasol.name).includes("クーポン"), false);
assert.equal(stripPromoText(parasol.name).includes("OFF"), false);
assert.equal(summarizeProduct(parasol).subject, "日傘");
assert.deepEqual(Array.from(summarizeProduct(parasol).features), ["超軽量", "形状記憶", "完全遮光"]);

for (const tone of ["polite", "casual", "oshi"]) {
  const intro = genIntro(parasol, tone);
  assert.equal(intro.includes("クーポン"), false, `${tone}: クーポンを含まない`);
  assert.equal(intro.includes("OFF"), false, `${tone}: OFF表記を含まない`);
  assert.equal(intro.includes("3000"), false, `${tone}: 価格を含まない`);
  assert.equal((intro.match(/日傘/g) || []).length, 1, `${tone}: 日傘を重複させない`);
  assert.ok(intro.length < 120, `${tone}: 読みやすい長さに収める`);
  assert.equal(/買った|購入|使った|愛用|リピ|早く買えば|使ってみ|おすすめします/.test(intro), false, `${tone}: 購入・使用済み表現を含まない`);
}

const tags = suggestTags(parasol);
assert.deepEqual(Array.from(tags).slice(0, 4), ["日傘", "超軽量", "形状記憶", "完全遮光"]);
assert.equal(tags.some(tag => /クーポン|OFF|ランキング/.test(tag)), false);
assert.equal(new Set(tags).size, tags.length, "タグを重複させない");

const carotePan = {
  name: "【激安★2点セットが2280円！】CAROTE カローテ 卵焼き フライパン 14*18cm 卵焼き器 ih対応 PFOA フリー PFOS フリー マーブルコート エッグパン 蓋付き スルスルすべる くっつくことがなく 手入れ簡単 グレージュ 一年保証 Cosyシリーズ（単品・2点セット・3点セット）",
  genre: "キッチン・日用品"
};
const caroteSummary = summarizeProduct(carotePan);
assert.equal(caroteSummary.subject, "卵焼きフライパン", "複合した商品カテゴリを優先する");
assert.deepEqual(Array.from(caroteSummary.features), ["IH対応","マーブルコート","蓋付き"], "実商品名から根拠のある仕様を優先する");
assert.equal(caroteSummary.features.some(feature => /激安|CAROTE|カローテ|2点セット/i.test(feature)), false, "販促語・ブランド名・セット数だけを特徴にしない");
for (const tone of ["polite", "casual", "oshi"]) {
  const intro = genIntro(carotePan, tone);
  assert.equal(/激安|CAROTE|カローテ|2点セット/i.test(intro), false, `${tone}: CAROTEの販促語・ブランド名・セット数を本文へ入れない`);
  assert.equal(intro.includes("気になるポイントがそろっています"), false, `${tone}: 根拠の薄い定型句を使わない`);
  assert.equal((intro.match(/卵焼きフライパン/g) || []).length, 1, `${tone}: 商品カテゴリを重複させない`);
  assert.equal(/買った|購入|使った|愛用|リピ|早く買えば|使ってみ|おすすめします/.test(intro), false, `${tone}: 購入・使用済み表現を含まない`);
}
assert.equal(suggestTags(carotePan).some(tag => /激安|CAROTE|カローテ|2点セット/i.test(tag)), false, "CAROTEの不要な語をタグへ入れない");

const caroteOnlyMarketing = {
  name: "激安 CAROTE カローテ 卵焼き フライパン 2点セットが",
  genre: "キッチン・日用品"
};
assert.deepEqual(Array.from(summarizeProduct(caroteOnlyMarketing).features), [], "販促語・ブランド名・セット数しかない場合は特徴を捏造しない");
assert.equal(genIntro(caroteOnlyMarketing, "oshi").includes("仕様を確認して選びたいアイテムです。"), true, "根拠になる仕様がない場合は自然な汎用文へ退避する");

for (const name of [
  "激安 CAROTEカローテ 卵焼き フライパン 2点セット が",
  "激安 カローテCAROTE 卵焼き フライパン 2点セット が"
]) {
  const product={name,genre:"キッチン・日用品"};
  assert.deepEqual(Array.from(summarizeProduct(product).features), [], "連結ブランド表記・空白分離された助詞を特徴化しない");
  assert.equal(/CAROTE|カローテ|がが特徴/i.test(genIntro(product,"oshi")), false, "表記揺れを本文へ漏らさない");
  assert.equal(suggestTags(product).some(tag=>/CAROTE|カローテ|^が$/i.test(tag)), false, "表記揺れをタグへ漏らさない");
}

const cases = [
  {name:"高保湿 化粧水 200mL 敏感肌用 無香料 セラミド配合", subject:"化粧水"},
  {name:"ステンレス タンブラー 480mL 真空断熱 保温保冷 マット", subject:"ステンレスタンブラー"},
  {name:"ワイヤレスイヤホン ノイズキャンセリング 低遅延 防水IPX5", subject:"ワイヤレスイヤホン"},
  {name:"リネン混 ワンピース ゆったり 春夏 マット素材 大人カジュアル", subject:"ワンピース"},
  {name:"【20%OFFクーポン】日傘 KONCIWA 5秒でたためる日傘 軽量 完全遮光 遮熱-30℃ 形状記憶", subject:"日傘"}
];
for (const item of cases) {
  const summary = summarizeProduct({...item, genre:""});
  assert.equal(summary.subject, item.subject, `${item.subject}: 商品カテゴリを抽出する`);
  const intro = genIntro({...item, genre:""}, "polite");
  assert.equal(/クーポン|\d+(?:%|％)OFF|ランキング|最安/.test(intro), false, `${item.subject}: 販促語を含まない`);
  assert.ok(intro.length < 120, `${item.subject}: 読みやすい長さに収める`);
}

console.log("--- 日傘 / 丁寧 ---\n" + genIntro(parasol, "polite"));
console.log("--- 日傘 / カジュアル ---\n" + genIntro(parasol, "casual"));
console.log("--- 日傘 / 推し語り ---\n" + genIntro(parasol, "oshi"));
console.log("--- タグ ---\n" + tags.map(tag => `#${tag}`).join(" "));
console.log("--- CAROTE卵焼きフライパン / 推し語り ---\n" + genIntro(carotePan, "oshi"));
console.log("intro-generation: all tests passed");
