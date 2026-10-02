// Expenses widget for Scriptable (iOS). Unit: thousand VND.
// First run inside Scriptable asks for the access key and stores it in the Keychain.
const API = "https://script.google.com/macros/s/AKfycbxfGJti6JuILSU_NeaFb5ATQPU5L00tY8uenZQFFT7xtukQqA0fZhBnu2mZI5crjE16/exec";
const APP = "https://bonyng.github.io/expenses/";
const KC = "expenses_key";

async function getKey() {
  if (Keychain.contains(KC)) return Keychain.get(KC);
  if (config.runsInWidget) return null;
  const a = new Alert();
  a.title = "Access key";
  a.addSecureTextField("Access key");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if ((await a.present()) < 0) return null;
  const k = a.textFieldValue(0).trim();
  if (k) Keychain.set(KC, k);
  return k || null;
}

async function call(fn, key, args) {
  const q = encodeURIComponent(JSON.stringify({ fn, args: args || [], key }));
  const r = new Request(API + "?q=" + q + "&_=" + Date.now());
  return await r.loadJSON();
}

const fmt = n => Math.round(n || 0).toLocaleString("en-US");
const GREEN = new Color("#2DB84C"), BG = new Color("#0E0E0F"), MUTED = new Color("#8E8E93");

function text(st, s, size, color, bold) {
  const t = st.addText(s);
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = color || Color.white();
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

// Ảnh nền riêng: chọn từ thư viện ảnh khi chạy script trong Scriptable, lưu trong máy.
const FM = FileManager.local();
const BG_PATH = FM.joinPath(FM.documentsDirectory(), "expenses_bg.jpg");
const CATS_PATH = FM.joinPath(FM.documentsDirectory(), "expenses_cats.json");

// Bấm widget → mở thẳng màn nhập chi (như Money Lover): số tiền → nhóm → lưu.
async function quickAdd(key) {
  let cats = [];
  try { cats = JSON.parse(FM.readString(CATS_PATH)); } catch (e) {}
  if (!cats.length) { try { const d = await call("widgetSummary", key); cats = (d && d.cats) || []; if (cats.length) FM.writeString(CATS_PATH, JSON.stringify(cats)); } catch (e) {} }
  while (true) {
    const a = new Alert();
    a.title = "Add expense";
    const amt = a.addTextField("Amount (thousand VND)");
    amt.setDecimalPadKeyboard();
    a.addTextField("Note");
    a.addAction("Next");
    a.addCancelAction("Cancel");
    if ((await a.present()) < 0) return;
    const amount = Number(a.textFieldValue(0).replace(/,/g, "").trim());
    const note = a.textFieldValue(1).trim();
    if (!(amount > 0)) continue;
    let category = cats.length ? null : "Ăn uống";
    if (cats.length) {
      const c = new Alert();
      c.title = fmt(amount) + (note ? " · " + note : "");
      cats.forEach(x => c.addAction((x.icon ? x.icon + "  " : "") + x.label));
      c.addCancelAction("Cancel");
      const i = await c.presentSheet();
      if (i < 0) return;
      category = cats[i].name;
    }
    const d = new Date(), pad = n => ("0" + n).slice(-2);
    const date = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    let res = null;
    try { res = await call("saveTransaction", key, [{ date, type: "expense", category, amount, note, wallet: "Cash" }]); } catch (e) {}
    const r = new Alert();
    const label = (cats.find(x => x.name === category) || {}).label || category;
    r.title = res && res.__ok ? "✓ Saved" : "Not saved";
    r.message = res && res.__ok ? fmt(amount) + " · " + label : String((res && res.error) || "Network error");
    r.addAction("Done");
    r.addAction("Add another");
    if ((await r.present()) !== 1) return;
  }
}

function applyBackground(w) {
  w.backgroundColor = BG;
  if (!FM.fileExists(BG_PATH)) return;
  w.backgroundImage = FM.readImage(BG_PATH);
  // Lớp tối mờ dần để chữ luôn đọc được trên mọi ảnh.
  const g = new LinearGradient();
  g.colors = [new Color("#000000", 0.55), new Color("#000000", 0.15), new Color("#000000", 0.55)];
  g.locations = [0, 0.5, 1];
  w.backgroundGradient = g;
}

async function menu() {
  const a = new Alert();
  a.title = "Expenses widget";
  a.addAction("Choose photo");
  if (FM.fileExists(BG_PATH)) a.addAction("Remove photo");
  a.addCancelAction("Preview");
  const i = await a.present();
  if (i === 0) {
    try { FM.writeImage(BG_PATH, await Photos.fromLibrary()); } catch (e) {}
  } else if (i === 1) {
    FM.remove(BG_PATH);
  }
}

async function build() {
  const w = new ListWidget();
  applyBackground(w);
  w.url = URLScheme.forRunningScript() + "?action=add";
  w.setPadding(14, 14, 14, 14);
  const key = await getKey();
  let d = null;
  try { if (key) d = await call("widgetSummary", key); } catch (e) {}
  if (d && d.__ok && d.cats && d.cats.length) FM.writeString(CATS_PATH, JSON.stringify(d.cats));
  if (!d || !d.__ok) {
    if (d && d.error === "Unauthorized" && Keychain.contains(KC)) Keychain.remove(KC);
    text(w, "💰 Expenses", 13, GREEN, true);
    w.addSpacer(6);
    text(w, key ? "Can't load data" : "Run in Scriptable to set key", 12, MUTED);
    return w;
  }
  // Không hiện số dư (riêng tư) — chỉ số đã chi hôm nay.
  text(w, "💰 Spent today", 12, Color.white());
  w.addSpacer(2);
  text(w, fmt(d.spentToday), 26, Color.white(), true);
  w.addSpacer();
  const add = w.addStack();
  add.backgroundColor = GREEN;
  add.cornerRadius = 10;
  add.setPadding(5, 0, 5, 0);
  add.addSpacer();
  text(add, "＋ Add", 13, Color.white(), true);
  add.addSpacer();
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return w;
}

const isAdd = args.queryParameters && args.queryParameters.action === "add";
if (isAdd && Keychain.contains(KC)) {
  await quickAdd(Keychain.get(KC));
} else {
  if (!config.runsInWidget && Keychain.contains(KC)) await menu();
  const widget = await build();
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentSmall();
}
Script.complete();
