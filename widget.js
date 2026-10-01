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

async function call(fn, key) {
  const q = encodeURIComponent(JSON.stringify({ fn, args: [], key }));
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
  w.url = APP;
  w.setPadding(14, 14, 14, 14);
  const key = await getKey();
  let d = null;
  try { if (key) d = await call("widgetSummary", key); } catch (e) {}
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
  add.url = APP + "?add=1";
  add.backgroundColor = GREEN;
  add.cornerRadius = 10;
  add.setPadding(5, 0, 5, 0);
  add.addSpacer();
  text(add, "＋ Add", 13, Color.white(), true);
  add.addSpacer();
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return w;
}

if (!config.runsInWidget && Keychain.contains(KC)) await menu();
const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentSmall();
Script.complete();
