const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const readConst = name => {
  const match = html.match(new RegExp(`const\\s+${name}\\s*=\\s*"([^"]*)"`));
  assert.ok(match, `${name}を取得できること`);
  return match[1];
};
const start = html.indexOf("const PROMO_WORDS=");
const end = html.indexOf("state=loadState();", start);
const context = {};
vm.createContext(context);
vm.runInContext(`${html.slice(start, end)}\nthis.api={summarizeProduct,suggestTags,genIntro};`, context);

const paramsFor = keyword => new URLSearchParams({
  applicationId: readConst("APP_ID"),
  accessKey: readConst("ACCESS_KEY"),
  format: "json",
  keyword,
  hits: "10",
  sort: "-reviewCount"
});
const unsafe = /買った|購入しました|使った|愛用|リピ|早く買えば|使ってみた|おすすめします/;
const promo = /クーポン|\d+(?:\.\d+)?\s*(?:%|％)\s*(?:OFF|オフ|割引)|ランキング|最安|特価|送料無料|ポイント\s*\d+倍/i;

async function fetchItems(keyword) {
  const url = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701?${paramsFor(keyword)}`;
  const request = () => fetch(url, {headers:{Referer:"https://ryotagubusiness-b1z.github.io/rakuten-room-tool/", Origin:"https://ryotagubusiness-b1z.github.io"}});
  let response = await request();
  if (response.status === 429) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    response = await request();
  }
  assert.equal(response.ok, true, `${keyword}: 楽天APIへ接続できること (${response.status})`);
  const data = await response.json();
  return (data.Items || []).map(entry => entry.Item || entry);
}

(async () => {
  for (const keyword of ["日傘", "化粧水", "イヤホン", "タンブラー"]) {
    const items = await fetchItems(keyword);
    assert.ok(items.length >= 5, `${keyword}: 5商品以上を検証できること`);
    for (const item of items) {
      const product = {name:item.itemName, genre:""};
      const summary = context.api.summarizeProduct(product);
      const tags = context.api.suggestTags(product);
      for (const tone of ["polite", "casual", "oshi"]) {
        const intro = context.api.genIntro(product, tone);
        assert.equal(promo.test(intro), false, `${keyword}/${tone}: 販促語を含まない`);
        assert.equal(unsafe.test(intro), false, `${keyword}/${tone}: 購入・使用済み表現を含まない`);
        assert.ok(intro.length <= 140, `${keyword}/${tone}: 140文字以内に収める`);
        assert.notEqual(intro.includes(item.itemName), true, `${keyword}/${tone}: 元の商品名をそのまま掲載しない`);
        if (summary.subject !== "商品") {
          assert.equal((intro.match(new RegExp(summary.subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1, `${keyword}/${tone}: 商品カテゴリを重複させない`);
        }
      }
      assert.equal(tags.some(tag => promo.test(tag)), false, `${keyword}: タグへ販促語を含めない`);
      assert.equal(new Set(tags).size, tags.length, `${keyword}: タグを重複させない`);
    }
    const sample = {name:items[0].itemName, genre:""};
    console.log(`[${keyword}] ${context.api.genIntro(sample, "polite").replace(/\n/g, " / ")}`);
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  console.log("live-intro-quality: all tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
