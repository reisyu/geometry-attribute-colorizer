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
        prevEntryColumns, rowComboState, COMBO_PREV, COMBO_BOTH, COMBO_NOW, COMBO_NONE,
        SURVEY_DATE_COL, SURVEYOR_COL, refIsCarried, columnRole, prevBaseRole,
        isDerivedColumn, isColorizableColumn, isReservedColumn, ATTR_INFO, COMBO_COL,
        colorSideOf,
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

/* 何を「該当」とみなすか — **値が入っているかどうかだけ**で決める。

   はじめは「なし」「非該当」などを否定の語として拾っていたが、やめた。
   項目名を性質の名前で付けると意味が反転する(「目地の充填」に「無」と
   書けば、それは所見そのもの)。辞書を持つと、その石が**グレーに沈んで
   図からは気づけない**。辞書が無ければ色付きで出るので、見れば直せる。
   失敗するなら気づける側に倒す */
{
  ok(isSurveyHit("あり"), "「あり」は該当");
  ok(isSurveyHit("該当"), "「該当」は該当");
  ok(isSurveyHit("要観察"), "知らない値も該当に数える(指摘を図から消さない)");
  ok(isSurveyHit(" あり "), "前後の空白は無視する");
  ok(isSurveyHit("1"), "数字でも該当");
  ok(!isSurveyHit(""), "空は該当ではない");
  ok(!isSurveyHit("   "), "空白だけも該当ではない");
  ok(!isSurveyHit(null), "nullは該当ではない");
  ok(!isSurveyHit(undefined), "undefinedも該当ではない");
  // **否定の語も該当に数える。** 運用は「該当した項目だけ印を付ける」で、
  // 空欄が「該当しない」を表す。書いてあるなら何か記録したということ
  ok(isSurveyHit("なし"), "**「なし」と書いてあれば該当に数える**(記録はされている)");
  ok(isSurveyHit("無"), "**「無」も該当に数える**(「目地の充填: 無」は所見そのもの)");
  ok(isSurveyHit("非該当"), "「非該当」も該当に数える");
}

/* 書き出さない。点検側の選択肢には出す */
{
  const COLS2 = ["ID", "Width", "石種", "剥離", HIT_COL];
  const S2 = new Set(["剥離"]);
  ok(!ledgerColumns(COLS2, S2).includes(HIT_COL), "**該当項目は台帳に書き出さない**(派生列)");
  ok(!surveyValueColumns(COLS2, S2).includes(HIT_COL), "記録にも書き出さない");
  ok(surveyVisualColumns(COLS2, S2).includes(HIT_COL), "点検側の色分けには出す");
}

/* ---------- 記録の状況は、メモと点検項目を同じ重みで数える ---------- */
/* メモを書かずに点検項目の印だけで記録する運用がある。メモだけを見ていたため、
   **印を付けた石が「記録なし」になり、同じ石が「履歴:記録回数」では1回と数えられて
   2枚の図が食い違っていた** */
{
  const NOW = ["はらみ出し", "ひび割れ", NOTE_COL];
  const PREV = [REF_PREFIX + "はらみ出し", REF_PREFIX + NOTE_COL];
  ok(rowComboState({ "はらみ出し": "あり" }, PREV, NOW) === COMBO_NOW,
     "**点検項目の印だけでも「今回のみ」**(メモが無くても記録)");
  ok(rowComboState({ [NOTE_COL]: "東面がはらむ" }, PREV, NOW) === COMBO_NOW, "メモだけでも「今回のみ」");
  ok(rowComboState({ [REF_PREFIX + "はらみ出し"]: "あり" }, PREV, NOW) === COMBO_PREV,
     "**前回の点検項目だけでも「前回のみ」**(回り残しとして赤で出す)");
  ok(rowComboState({ [REF_PREFIX + NOTE_COL]: "割れ" }, PREV, NOW) === COMBO_PREV, "前回のメモだけでも「前回のみ」");
  ok(rowComboState({ [REF_PREFIX + NOTE_COL]: "割れ", "ひび割れ": "あり" }, PREV, NOW) === COMBO_BOTH,
     "前回はメモ・今回は点検項目でも「前回と今回」(書き方が変わっても同じ石)");
  ok(rowComboState({}, PREV, NOW) === COMBO_NONE, "どちらも無ければ「記録なし」");
  ok(rowComboState({ "石種": "花崗岩" }, PREV, NOW) === COMBO_NONE,
     "**属性だけの石は記録にしない**(点検していない)");
  ok(rowComboState({ "はらみ出し": "  " }, PREV, NOW) === COMBO_NONE, "空白だけは記録にしない");
  ok(rowComboState(null, PREV, NOW) === COMBO_NONE, "行がnullでも落ちない");
  ok(rowComboState({ "はらみ出し": "あり" }, [], []) === COMBO_NONE, "見る列が無ければ「記録なし」");
}

/* 前回の記録として数える列 */
{
  const cols = ["ID", "Width", "石種", "はらみ出し", NOTE_COL,
                REF_PREFIX + NOTE_COL, REF_PREFIX + NOTE_FLAG_COL, REF_PREFIX + "はらみ出し",
                REF_PREFIX + SURVEY_DATE_COL, REF_PREFIX + SURVEYOR_COL, HIST_PREFIX + "記録回数"];
  const p = prevEntryColumns(cols, new Set(["はらみ出し"]));
  ok(p.includes(REF_PREFIX + NOTE_COL) && p.includes(REF_PREFIX + "はらみ出し"),
     "前回のメモと点検項目を数える", j(p));
  ok(!p.includes(REF_PREFIX + NOTE_FLAG_COL),
     "**「前回:メモの有無」は数えない**(記録が無くても「なし」が入るので、値の有無で判定できない)");
  ok(!p.includes(REF_PREFIX + SURVEY_DATE_COL) && !p.includes(REF_PREFIX + SURVEYOR_COL),
     "点検日と点検者は数えない(記録の鍵であって所見ではない)");
  ok(!p.includes("はらみ出し") && !p.includes(NOTE_COL), "今回の列は入れない");
  ok(!p.includes(HIST_PREFIX + "記録回数"), "履歴の列は入れない");
  ok(j(prevEntryColumns(null, null)) === "[]", "nullでも落ちない");
  /* 「属性をCSVで保存」したファイルを前回として重ねたときの列。属性と該当項目が
     前回の列になる。**全行に値が入っているので、数えると全部の石が赤になる** */
  const flat = [REF_PREFIX + "石種", REF_PREFIX + HIT_COL, REF_PREFIX + NOTE_COL,
                REF_PREFIX + NOTE_FLAG_COL, REF_PREFIX + "はらみ出し"];
  const pf = prevEntryColumns(flat, new Set(["はらみ出し"]));
  ok(!pf.includes(REF_PREFIX + "石種"), "**属性の前回分は数えない**(点検の記録ではない)");
  ok(!pf.includes(REF_PREFIX + HIT_COL), "**「前回:該当項目」は数えない**(全行に「なし」が入る派生列)");
  ok(j(pf) === j([REF_PREFIX + NOTE_COL, REF_PREFIX + "はらみ出し"]),
     "数えるのは前回のメモと、いま定義されている点検項目だけ", j(pf));
  ok(j(prevEntryColumns(flat, new Set())) === j([REF_PREFIX + NOTE_COL]),
     "点検項目が1つも無ければメモだけ");
  ok(rowComboState({ [REF_PREFIX + "石種"]: "花崗岩", [REF_PREFIX + HIT_COL]: "なし" }, pf, ["はらみ出し"]) === COMBO_NONE,
     "**前回の属性と該当項目だけの石を「前回のみ」にしない**");
  ok(!refIsCarried(HIT_COL, new Set()), "「該当項目」は前回の列として重ねない");
  // 「なし」が入っていても前回の記録にしない(列ごと外してあるため)
  ok(rowComboState({ [REF_PREFIX + NOTE_FLAG_COL]: "なし" }, p, ["はらみ出し"]) === COMBO_NONE,
     "**前回のメモの有無が「なし」の石を「前回のみ」にしない**");
}

/* ---------- 前回の記録から重ねる列 ---------- */
/* 列名を文字列で直書きしていたため、点検日の列名を変えたときに取り残され、
   **「前回:InspectionDate」「前回:点検者」が属性の色分けの選択肢に出ていた** */
{
  const S = new Set(["石種"]);
  ok(!refIsCarried(SURVEY_DATE_COL, S), "**点検日は重ねない**(見出しに1回出すだけ)");
  ok(!refIsCarried(SURVEYOR_COL, S), "**点検者も重ねない**(記録の鍵であって所見ではない)");
  ok(refIsCarried(NOTE_COL, S), "メモは重ねる(いちばん運びたいもの)");
  ok(refIsCarried(NOTE_FLAG_COL, S), "メモの有無も重ねる");
  ok(refIsCarried("はらみ出し", S), "点検項目は重ねる");
  ok(!refIsCarried("石種", S), "静的な属性は重ねない(前回と今回で同じ値)");
  ok(!refIsCarried("Width", S), "幾何属性は重ねない");
  ok(refIsCarried("はらみ出し", null), "静的な列の集合が無くても落ちない");
  ok(!refIsCarried(REF_PREFIX + "はらみ出し", S) && !refIsCarried(HIST_PREFIX + "記録回数", S),
     "前回・履歴の列を重ね直さない(「前回:前回:…」を作らない)");
}

/* ---------- 列の種別(§5.1.7) ---------- */
/* 「この列は何か」に答える関数が16個に分かれ、答えが食い違っていた。
   色分けに出さないはずの列が点検側の選択肢にだけ出る、記録の鍵の列名で
   点検項目を作れる、といった不具合はここから出た(v1.40.3)。
   種別を決める場所を columnRole 1つにし、ほかは種別を見て決める */
{
  const S = new Set(["はらみ出し", "ひび割れ"]);
  const cases = [
    [REF_PREFIX + NOTE_COL, "prev"], [REF_PREFIX + "はらみ出し", "prev"], [REF_PREFIX + "石種", "prev"],
    [HIST_PREFIX + "記録回数", "hist"], [COMBO_COL, "hist"],
    [NOTE_COL, "note"], [NOTE_FLAG_COL, "noteFlag"], [HIT_COL, "hit"],
    [SURVEY_DATE_COL, "key"], [SURVEYOR_COL, "key"],
    ["Width", "computed"], ["SrcID", "computed"], ["Dataset", "computed"],
    ["はらみ出し", "survey"], ["ひび割れ", "survey"],
    ["石種", "attr"], ["エリア", "attr"], ["ID", "attr"], ["謎の列", "attr"],
  ];
  for (const [name, role] of cases) {
    ok(columnRole(name, S) === role, "種別: " + name + " → " + role, "(" + columnRole(name, S) + ")");
  }
  ok(Object.keys(ATTR_INFO).every((k) => {
    const r = columnRole(k, S);
    return r === "computed" || r === "note" || r === "noteFlag";
  }), "ATTR_INFOの列はすべて自動計算かメモ(将来増えても取りこぼさない)");

  // 種別が分からないものは静的に倒す(§5.1.6)
  ok(columnRole("はらみ出し", null) === "attr", "**点検項目の集合が無ければ attr**(分からないものは静的に倒す)");
  ok(columnRole("はらみ出し", new Set()) === "attr", "集合が空でも attr");
  ok(columnRole(null, S) === "attr" && columnRole(undefined, S) === "attr", "null・undefined でも落ちない");
  ok(columnRole("", S) === "attr", "空文字でも落ちない");

  /* **名前で決まる種別が、手入力の種別より先。** 記録CSVを読むと、ヘッダにあった列は
     すべて点検項目として登録される。メモの列もそこに入るので、順序が逆だと
     メモが点検項目として扱われる */
  const weird = new Set([NOTE_COL, NOTE_FLAG_COL, HIT_COL, SURVEYOR_COL, "Width", REF_PREFIX + "x"]);
  ok(columnRole(NOTE_COL, weird) === "note", "**メモは、点検項目に登録されていてもメモ**");
  ok(columnRole(NOTE_FLAG_COL, weird) === "noteFlag", "メモの有無も同じ");
  ok(columnRole(HIT_COL, weird) === "hit", "該当項目も同じ");
  ok(columnRole(SURVEYOR_COL, weird) === "key", "**記録の鍵は、点検項目に登録されていても鍵**");
  ok(columnRole("Width", weird) === "computed", "自動計算の列も同じ");
  ok(columnRole(REF_PREFIX + "x", weird) === "prev", "前回の列も同じ");
  ok(!surveyValueColumns([SURVEYOR_COL, NOTE_FLAG_COL, HIT_COL, "Width"], weird).length,
     "**鍵・メモの有無・該当項目・自動計算の列は、記録の値の列にならない**");
  ok(j(surveyValueColumns([NOTE_COL, "はらみ出し"], new Set([NOTE_COL, "はらみ出し"]))) === j([NOTE_COL, "はらみ出し"]),
     "メモと点検項目は記録の値の列");

  // 「前回:」を外した元の列の種別
  ok(prevBaseRole(REF_PREFIX + NOTE_COL, S) === "note", "前回:メモ の元はメモ");
  ok(prevBaseRole(REF_PREFIX + "はらみ出し", S) === "survey", "前回:点検項目 の元は点検項目");
  ok(prevBaseRole(REF_PREFIX + "石種", S) === "attr", "前回:属性 の元は属性");
  ok(prevBaseRole("はらみ出し", S) === null, "前回の列でなければ null");
  ok(prevBaseRole(null, S) === null, "nullでも落ちない");
}

/* ---------- どの列も、行き先がちょうど1つに決まる ---------- */
/* 書き出し先(台帳か記録か、どちらでもないか)と、色分けの選択肢(属性側か点検側か、
   どちらにも出さないか)。条件を別々に書いていたときは、片方だけ直して食い違った */
{
  const S = new Set(["はらみ出し", "ひび割れ"]);
  const all = [...Object.keys(ATTR_INFO), "ID", "石種", "エリア", "はらみ出し", "ひび割れ", "謎の列",
               HIT_COL, SURVEY_DATE_COL, SURVEYOR_COL, COMBO_COL, HIST_PREFIX + "記録回数",
               REF_PREFIX + NOTE_COL, REF_PREFIX + NOTE_FLAG_COL, REF_PREFIX + "はらみ出し", REF_PREFIX + "石種"];
  const led = new Set(ledgerColumns(all, S));
  const rec = new Set(surveyValueColumns(all, S));
  const both = all.filter((c) => led.has(c) && rec.has(c));
  ok(both.length === 0, "**台帳と記録の両方に入る列が無い**", j(both));
  const neither = all.filter((c) => !led.has(c) && !rec.has(c));
  ok(neither.every((c) => isDerivedColumn(c) || c === NOTE_FLAG_COL || c === HIT_COL),
     "**どちらにも入らないのは、作り直せる列だけ**(前回・履歴・メモの有無・該当項目)", j(neither));

  // 色分けの選択肢。属性側 = 色分けに出す列から点検側を除いたもの(画面と同じ組み立て)
  const colorable = all.filter((c) => isColorizableColumn(c, "ID"));
  const surveySide = new Set(surveyVisualColumns(all, S).filter((c) => isColorizableColumn(c, "ID")));
  const attrSide = colorable.filter((c) => !surveySide.has(c));
  ok(!attrSide.some((c) => S.has(c)), "**点検項目が属性側の色分けに出ない**", j(attrSide.filter((c) => S.has(c))));
  ok(!attrSide.some((c) => c.startsWith(HIST_PREFIX) || c === HIT_COL),
     "履歴と該当項目が属性側の色分けに出ない");
  ok(![...surveySide].some((c) => c === "石種" || c === "Width"), "属性と幾何属性が点検側の色分けに出ない");
  ok(![...surveySide].some((c) => c === NOTE_FLAG_COL || c === REF_PREFIX + NOTE_FLAG_COL),
     "**メモの有無・前回のメモの有無は、点検側の色分けにも出ない**(記録の状況で読める)",
     j([...surveySide]));
  ok(![...colorable].some((c) => c === NOTE_COL || c === REF_PREFIX + NOTE_COL || c === "ID"),
     "メモ本文とIDは、どちらの色分けにも出ない");
  ok(surveySide.has(REF_PREFIX + "はらみ出し") && attrSide.includes(REF_PREFIX + "石種"),
     "前回の列は、元の列と同じ側に出る");

  // 手で作れる列名は attr だけ(名前で種別が決まる列はすべて予約)
  ok(all.filter((c) => !isReservedColumn(c, "")).every((c) => columnRole(c, null) === "attr"),
     "**予約されていない名前は、すべて attr**");
}

/* ---------- 塗っている列は、どちらの色分けか ---------- */
/* 色分けの状態は「いま塗っている列」1つで持ち、属性側か点検側かはそこから決める
   (§5.1.6)。以前は「どちらで選んだか」を別に持っていて、まとめ書き出しで
   属性を差し替えても点検側のままになり、どのシートも同じ図になった */
{
  const S = new Set(["はらみ出し"]);
  ok(colorSideOf("Width", S) === "attr", "幾何属性は属性側");
  ok(colorSideOf("石種", S) === "attr", "手で作った属性は属性側");
  ok(colorSideOf("はらみ出し", S) === "survey", "点検項目は点検側");
  ok(colorSideOf(HIT_COL, S) === "survey", "該当項目は点検側");
  ok(colorSideOf(COMBO_COL, S) === "survey", "記録の状況は点検側");
  ok(colorSideOf(HIST_PREFIX + "記録回数", S) === "survey", "履歴は点検側");
  ok(colorSideOf(REF_PREFIX + "はらみ出し", S) === "survey", "点検項目の前回分は点検側");
  ok(colorSideOf(REF_PREFIX + "石種", S) === "attr", "属性の前回分は属性側");
  ok(colorSideOf(null, S) === null && colorSideOf("", S) === null, "**塗っていなければ null**(どちらのチェックも点かない)");
  ok(colorSideOf("はらみ出し", null) === "attr", "点検項目の集合が無ければ属性側(分からないものは静的に倒す)");
  /* 種別を変えると側も移る。「点検項目に変える」を押したら、属性側のチェックが消えて
     点検側のチェックが点く(塗っている列そのものは変わらない) */
  ok(colorSideOf("石種", new Set(["石種"])) === "survey", "**点検項目に変えた列は点検側に移る**");
  // 2つの選択肢は重ならない(どちらか一方のチェックだけが点く)
  const all = ["Width", "石種", "はらみ出し", HIT_COL, COMBO_COL, HIST_PREFIX + "記録回数",
               REF_PREFIX + "はらみ出し", REF_PREFIX + "石種"];
  const surveySide = new Set(surveyVisualColumns(all, S));
  ok(all.every((c) => (colorSideOf(c, S) === "survey") === surveySide.has(c)),
     "**点検側と判定する列は、点検側の選択肢に出る列と一致する**");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
