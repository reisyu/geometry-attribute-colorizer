"use strict";
/*
 * 静的な属性と点検項目の分離(§5.1.6)。
 *
 * 手入力の列には性質の違う2種類が混ざっていた。
 *   静的な属性(石種・エリア) — 石そのものの性質。1石に1つ。調査日にも調査者にも依存しない
 *   点検項目(はらみ出し)     — ある日ある人が見た所見。鍵は ID×調査日×調査者
 *
 * 分けないと、**石種を入れただけの石が「点検した石」として履歴に数えられる**。
 * 「何度も指摘されている石が図に浮かぶ」図に、点検していない石が混ざっていた。
 *
 * 種別は**保存先そのもの**で決める。台帳CSVに入っていた列は静的、
 * 記録CSVに入っていた列は点検項目。新しい接頭辞も設定ファイルも持たない。
 * ここで検証するのは、その振り分けを決める純関数。
 */
const { ledgerColumns, surveyValueColumns, surveyVisualColumns, hasSurveyEntry,
        isSurveyHit, surveyHitLabel, HIT_COL, HIT_MULTI, HIT_NONE,
        NOTE_COL, NOTE_FLAG_COL, REF_PREFIX, HIST_PREFIX } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };
const j = (a) => JSON.stringify(a);

/* 典型的な列構成。幾何属性・ID・静的な属性・点検項目・メモ・派生列 */
const COLS = ["ID", "Width", "Area", "石種", "エリア", "はらみ出し", "ひび割れ",
              NOTE_COL, NOTE_FLAG_COL,
              REF_PREFIX + "はらみ出し", HIST_PREFIX + "記録回数"];
const SURVEY = new Set(["はらみ出し", "ひび割れ"]);

/* ---------- 台帳に入る列 ---------- */
{
  const led = ledgerColumns(COLS, SURVEY);
  ok(led.includes("石種") && led.includes("エリア"), "**静的な属性は台帳に入る**", j(led));
  ok(led.includes("ID") && led.includes("Width"), "幾何属性とIDも台帳に入る");
  ok(!led.includes("はらみ出し") && !led.includes("ひび割れ"),
     "**点検項目は台帳に入れない**(調査日と調査者の鍵が付いてしまう)");
  ok(!led.includes(NOTE_COL), "メモは台帳に入れない(点検ごとの記録)");
  ok(!led.includes(NOTE_FLAG_COL), "メモの有無も台帳に入れない(メモから作る派生)");
  ok(!led.includes(REF_PREFIX + "はらみ出し") && !led.includes(HIST_PREFIX + "記録回数"),
     "派生列は書き出さない");
}
{
  // 種別が分からない列は台帳側。記録側に倒すと履歴が汚れるので、安全な側へ寄せる
  const led = ledgerColumns(["ID", "謎の列"], new Set());
  ok(led.includes("謎の列"), "**種別が分からない列は台帳に入れる**(安全な側に倒す)");
}

/* ---------- 記録に入る列 ---------- */
{
  const rec = surveyValueColumns(COLS, SURVEY);
  ok(rec.includes("はらみ出し") && rec.includes("ひび割れ"), "**点検項目は記録に入る**", j(rec));
  ok(rec.includes(NOTE_COL), "メモも記録に入る(点検ごとの所見)");
  ok(!rec.includes("石種"), "**静的な属性は記録に入れない**");
  ok(!rec.includes("Width") && !rec.includes("ID"), "幾何属性とIDは記録に入れない");
  ok(!rec.includes(NOTE_FLAG_COL), "メモの有無は派生なので記録に入れない");
}

/* ---------- 台帳と記録は重ならない ---------- */
/* 同じ列が両方に入ると、読み戻したときにどちらの種別か決まらない */
{
  const led = new Set(ledgerColumns(COLS, SURVEY));
  const both = surveyValueColumns(COLS, SURVEY).filter((c) => led.has(c));
  ok(both.length === 0, "**同じ列が台帳と記録の両方に入らない**(種別が決まらなくなる)", j(both));
}

/* ---------- 点検結果の色分けに出す列 ---------- */
/* ステップ3のドロップダウンからは外す。点検項目を10本作ると選択肢が10本増え、
   「前回:」も付くと20本になって選べなくなる */
{
  const vis = surveyVisualColumns(COLS, SURVEY);
  ok(vis.includes("はらみ出し"), "点検項目は点検側に出す", j(vis));
  ok(vis.includes(HIST_PREFIX + "記録回数"), "履歴の集計列も点検側");
  ok(vis.includes(REF_PREFIX + "はらみ出し"), "点検項目の「前回:」も点検側");
  ok(vis.includes(NOTE_FLAG_COL), "メモの有無も点検側");
  ok(!vis.includes("石種") && !vis.includes("エリア"), "**静的な属性は点検側に出さない**");
  ok(!vis.includes("Width"), "幾何属性も点検側に出さない");
}
{
  // 「前回:石種」は静的な属性のものなので点検側ではない(そもそも作られないが、
  // 古いデータから来ることがある)
  const vis = surveyVisualColumns([REF_PREFIX + "石種", REF_PREFIX + "はらみ出し"], SURVEY);
  ok(!vis.includes(REF_PREFIX + "石種"), "**静的な属性の「前回:」は点検側に出さない**", j(vis));
  ok(vis.includes(REF_PREFIX + "はらみ出し"), "点検項目の「前回:」だけ出す");
}

/* ---------- 記録行を作るかどうか ---------- */
/* ここが履歴の汚れの元。手入力の列すべてを見ていたため、石種を入れただけの石が
   記録行になり、履歴:記録回数=1 になっていた */
{
  const cols = ["はらみ出し", NOTE_COL];
  ok(hasSurveyEntry({ "はらみ出し": "該当" }, cols), "点検項目に値があれば記録行を作る");
  ok(hasSurveyEntry({ [NOTE_COL]: "東面がはらむ" }, cols), "メモがあれば記録行を作る");
  ok(!hasSurveyEntry({ "石種": "花崗岩" }, cols),
     "**石種だけの石は記録行にしない**(点検していないため)");
  ok(!hasSurveyEntry({ "はらみ出し": "" }, cols), "空なら作らない");
  ok(!hasSurveyEntry({ "はらみ出し": "   " }, cols), "空白だけでも作らない");
  ok(!hasSurveyEntry({}, cols), "何も無ければ作らない");
  ok(!hasSurveyEntry({ "はらみ出し": null }, cols), "nullでも作らない");
  ok(!hasSurveyEntry(null, cols), "行がnullでも落ちない");
  ok(!hasSurveyEntry({ "はらみ出し": "該当" }, []), "見る列が無ければ作らない");
  ok(!hasSurveyEntry({ "はらみ出し": "該当" }, null), "列がnullでも落ちない");
  ok(hasSurveyEntry({ "はらみ出し": 0 }, cols), "数値の0も入力とみなす(空とは違う)");
}

/* ---------- 壊れた入力 ---------- */
ok(j(ledgerColumns(null, SURVEY)) === "[]", "列がnullでも落ちない");
ok(j(ledgerColumns([], SURVEY)) === "[]", "空なら空");
ok(j(surveyValueColumns(COLS, null)).includes(NOTE_COL), "点検項目の集合がnullでもメモは記録へ");
ok(j(surveyVisualColumns(null, SURVEY)) === "[]", "点検側の一覧もnullで落ちない");
{
  // 配列で渡しても Set と同じに扱う(呼び出し側がどちらでも壊れない)
  const a = ledgerColumns(COLS, ["はらみ出し", "ひび割れ"]);
  const b = ledgerColumns(COLS, SURVEY);
  ok(j(a) === j(b), "点検項目の集合は配列でもSetでも同じ");
}

/* ---------- 点検項目をまとめた1枚の図 ---------- */
/* 項目ごとに色分けすると、項目の数だけ図を見比べることになる。
   「どの石に何が出ているか」を1枚で読めるようにする */
{
  const ITEMS = ["剥離", "割れ", "はらみ出し"];
  ok(surveyHitLabel({ "剥離": "あり" }, ITEMS) === "剥離", "1つだけなら項目名");
  ok(surveyHitLabel({ "割れ": "あり" }, ITEMS) === "割れ", "別の項目でも項目名");
  ok(surveyHitLabel({ "剥離": "あり", "割れ": "あり" }, ITEMS) === HIT_MULTI,
     "**2つ以上なら「複数」**(いちばん重い石を1色で拾う)");
  ok(surveyHitLabel({ "剥離": "あり", "割れ": "あり", "はらみ出し": "あり" }, ITEMS) === HIT_MULTI,
     "3つでも「複数」");
  ok(surveyHitLabel({}, ITEMS) === HIT_NONE, "どれも該当しなければ「なし」");
  ok(surveyHitLabel({ "石種": "花崗岩" }, ITEMS) === HIT_NONE,
     "**点検項目以外の値は見ない**(石種は該当ではない)");
  ok(surveyHitLabel(null, ITEMS) === HIT_NONE, "行がnullでも落ちない");
  ok(surveyHitLabel({ "剥離": "あり" }, []) === HIT_NONE, "項目が無ければ「なし」");
  ok(surveyHitLabel({ "剥離": "あり" }, null) === HIT_NONE, "項目がnullでも落ちない");
  // **全行に必ず値が入る**(空にすると欠損扱いで灰色になり「なし」と区別できない)
  ok(surveyHitLabel({}, ITEMS) !== "", "値を空にしない(欠損と区別できなくなる)");
}

/* 何を「該当」とみなすか */
{
  ok(isSurveyHit("あり"), "「あり」は該当");
  ok(isSurveyHit("該当"), "「該当」は該当");
  ok(isSurveyHit("要観察"), "**知らない値も該当に数える**(指摘を図から消さない)");
  ok(isSurveyHit(" あり "), "前後の空白は無視する");
  ok(!isSurveyHit(""), "空は該当ではない");
  ok(!isSurveyHit("   "), "空白だけも該当ではない");
  ok(!isSurveyHit(null), "nullは該当ではない");
  ok(!isSurveyHit(undefined), "undefinedも該当ではない");
  // 否定の語だけは拾う。「なし」と書いてあるものを該当に数えるのは明らかな誤読
  ok(!isSurveyHit("なし"), "**「なし」は該当ではない**");
  ok(!isSurveyHit("無"), "「無」も該当ではない");
  ok(!isSurveyHit("非該当"), "「非該当」も該当ではない");
  ok(!isSurveyHit("該当なし"), "「該当なし」も該当ではない");
}

/* 書き出さない。点検側の選択肢には出す */
{
  const COLS2 = ["ID", "Width", "石種", "剥離", HIT_COL];
  const S2 = new Set(["剥離"]);
  ok(!ledgerColumns(COLS2, S2).includes(HIT_COL), "**該当項目は台帳に書き出さない**(派生列)");
  ok(!surveyValueColumns(COLS2, S2).includes(HIT_COL), "記録にも書き出さない");
  ok(surveyVisualColumns(COLS2, S2).includes(HIT_COL), "点検側の色分けには出す");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
