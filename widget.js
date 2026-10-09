// Expenses widget for Scriptable (iOS) — Money Lover style. Unit: thousand VND.
// First run inside Scriptable asks for the access key and stores it in the Keychain.
// Sizes: Small = spent this month + budget bar + Add · Medium = + quick-add category buttons · Large = + top spending.
// Tap → the app's own add screen (calculator keypad, categories) opens full screen inside Scriptable.
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
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Ảnh nền riêng: chọn từ thư viện ảnh khi chạy script trong Scriptable, lưu trong máy.
const FM = FileManager.local();
const BG_PATH = FM.joinPath(FM.documentsDirectory(), "expenses_bg.jpg");
const HAS_PHOTO = FM.fileExists(BG_PATH);

// Bảng màu: nền sáng/tối theo máy (như Money Lover); có ảnh nền thì chữ trắng.
const GREEN = new Color("#2DB84C"), RED = new Color("#FF5A52"), AMBER = new Color("#F5A623");
const BG = Color.dynamic(new Color("#FFFFFF"), new Color("#1C1C1E"));
const TEXT = HAS_PHOTO ? Color.white() : Color.dynamic(new Color("#1C1C1E"), new Color("#FFFFFF"));
const MUTED = HAS_PHOTO ? new Color("#FFFFFF", 0.75) : new Color("#8E8E93");
const CHIP = HAS_PHOTO ? new Color("#FFFFFF", 0.22) : Color.dynamic(new Color("#F0F2F5"), new Color("#2C2C2E"));

function text(st, s, size, color, weight) {
  const t = st.addText(s);
  t.font = weight === "heavy" ? Font.heavySystemFont(size) : weight ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color || TEXT;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

/** Thanh tiến độ vẽ bằng DrawContext: fill = đã chi / ngân sách, vạch = mức nên chi tới hôm nay. */
function barImage(width, ratio, marker, color) {
  const h = 8, dc = new DrawContext();
  dc.size = new Size(width, h + 4);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const track = new Path();
  track.addRoundedRect(new Rect(0, 2, width, h), h / 2, h / 2);
  dc.addPath(track);
  dc.setFillColor(HAS_PHOTO ? new Color("#FFFFFF", 0.3) : new Color("#8E8E93", 0.25));
  dc.fillPath();
  const w = Math.max(h, Math.min(1, ratio) * width);
  if (ratio > 0) {
    const fill = new Path();
    fill.addRoundedRect(new Rect(0, 2, w, h), h / 2, h / 2);
    dc.addPath(fill);
    dc.setFillColor(color);
    dc.fillPath();
  }
  if (marker > 0 && marker < 1) {
    dc.setFillColor(HAS_PHOTO ? Color.white() : new Color("#8E8E93"));
    dc.fillRect(new Rect(marker * width - 1, 0, 2, h + 4));
  }
  return dc.getImage();
}

// Màu giống app: vượt cả tháng hoặc vượt nhịp tới hôm nay (target to date) → đỏ.
// Nhịp chỉ tính phần linh hoạt (không gồm chi phí cố định như Hoá đơn) — server tính, cùng số với trang Budgets.
const regular = d => d.spentMTD;
const flexDiff = d => d.flexSpent != null ? d.flexSpent - d.paceToDate : d.spentMTD - d.budget * d.day / d.days;
function paceColor(d) {
  if (!d.budget) return GREEN;
  if (regular(d) > d.budget || flexDiff(d) > 0) return RED;
  return GREEN;
}

function header(st, d) {
  const h = st.addStack();
  h.centerAlignContent();
  const logo = h.addStack();
  logo.backgroundColor = GREEN;
  logo.cornerRadius = 6;
  logo.size = new Size(20, 20);
  logo.centerAlignContent();
  text(logo, "₫", 12, Color.white(), true);
  h.addSpacer(6);
  text(h, "Expenses", 13, TEXT, true);
  h.addSpacer();
  if (d) text(h, MON[+d.month.slice(5, 7) - 1], 12, MUTED, true);
}

/** Khối chính: đã chi tháng này + thanh ngân sách + dòng còn lại. */
function summary(st, d, width, showDiff) {
  text(st, "Spent this month", 11, MUTED);
  st.addSpacer(1);
  const sr = st.addStack();
  sr.bottomAlignContent();
  const v = text(sr, fmt(d.spentMTD), 24, TEXT, "heavy");
  v.textColor = d.budget && regular(d) > d.budget ? RED : TEXT;
  // Medium/Large: chênh lệch so với target to date (= budget × ngày/tổng ngày, giống trang Budgets). Dương = chi nhanh hơn nhịp.
  if (showDiff && d.budget) {
    const diff = flexDiff(d);
    sr.addSpacer(5);
    const c = sr.addStack();
    c.layoutVertically();
    text(c, (diff > 0 ? "+" : "−") + fmt(Math.abs(diff)), 12, diff > 0 ? RED : GREEN, true);
    text(c, "vs pace", 9, MUTED);
    sr.addSpacer();
  }
  st.addSpacer(5);
  const ratio = d.budget ? regular(d) / d.budget : 0;
  const img = st.addImage(barImage(width, ratio, d.budget ? d.day / d.days : 0, paceColor(d)));
  img.imageSize = new Size(width, 12);
  st.addSpacer(4);
  // Medium/Large: còn được tiêu hôm nay / mức hôm nay · dự đoán cuối tháng (giống đầu trang Budgets).
  if (showDiff && d.budget && d.todayBudget != null) {
    text(st, "Today " + fmt(d.todayLeft) + "/" + fmt(d.todayBudget) + " · Fcst " + fmt(d.forecast), 11, d.todayLeft < 0 ? RED : MUTED, true);
    return;
  }
  const left = d.budget - regular(d), daysLeft = d.days - d.day + 1;
  const line = !d.budget ? "Today " + fmt(d.spentToday)
    : left >= 0 ? "Left " + fmt(left) + " · " + daysLeft + "d" : "Over " + fmt(-left);
  text(st, line, 11, d.budget && left < 0 ? RED : MUTED, true);
}

function addButton(st, label) {
  const b = st.addStack();
  b.backgroundColor = GREEN;
  b.cornerRadius = 12;
  b.setPadding(6, 0, 6, 0);
  b.url = URLScheme.forRunningScript() + "?action=add";
  b.addSpacer();
  text(b, label, 13, Color.white(), true);
  b.addSpacer();
}

/** Nút nhóm hay dùng: chạm → nhập luôn số tiền cho nhóm đó. */
function catButton(row, c) {
  const col = row.addStack();
  col.layoutVertically();
  col.size = new Size(48, 0);
  col.url = URLScheme.forRunningScript() + "?action=add&cat=" + encodeURIComponent(c.name);
  const top = col.addStack();
  top.addSpacer();
  const ic = top.addStack();
  ic.size = new Size(40, 40);
  ic.cornerRadius = 20;
  ic.backgroundColor = CHIP;
  ic.centerAlignContent();
  text(ic, c.icon || "•", 19);
  top.addSpacer();
  col.addSpacer(3);
  const lb = col.addStack();
  lb.addSpacer();
  const t = text(lb, c.label, 10, MUTED);
  t.minimumScaleFactor = 0.7;
  lb.addSpacer();
}

function applyBackground(w) {
  w.backgroundColor = BG;
  if (!HAS_PHOTO) return;
  w.backgroundImage = FM.readImage(BG_PATH);
  // Lớp tối mờ dần để chữ luôn đọc được trên mọi ảnh.
  const g = new LinearGradient();
  g.colors = [new Color("#000000", 0.55), new Color("#000000", 0.25), new Color("#000000", 0.6)];
  g.locations = [0, 0.5, 1];
  w.backgroundGradient = g;
}

async function build(fam) {
  fam = fam || config.widgetFamily || "medium";
  const w = new ListWidget();
  applyBackground(w);
  w.url = URLScheme.forRunningScript() + "?action=add";
  w.setPadding(14, 14, 14, 14);
  const key = await getKey();
  let d = null;
  try { if (key) d = await call("widgetSummary", key); } catch (e) {}
  if (!d || !d.__ok) {
    if (d && d.error === "Unauthorized" && Keychain.contains(KC)) Keychain.remove(KC);
    header(w, null);
    w.addSpacer(8);
    text(w, key ? "Can't load data" : "Run in Scriptable to set key", 12, MUTED);
    w.addSpacer();
    addButton(w, "＋ Add");
    return w;
  }
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  // Không hiện số dư (riêng tư) — chỉ số đã chi.
  if (fam === "small") {
    header(w, d);
    w.addSpacer(8);
    summary(w, d, 128);
    w.addSpacer();
    addButton(w, "＋ Add");
    return w;
  }
  const body = w.addStack();
  const left = body.addStack();
  left.layoutVertically();
  left.size = new Size(134, 0);
  header(left, d);
  left.addSpacer(8);
  summary(left, d, 134, true);
  left.addSpacer();
  addButton(left, "＋ Add");
  body.addSpacer(14);
  const right = body.addStack();
  right.layoutVertically();
  text(right, "Quick add", 11, MUTED, true);
  right.addSpacer(6);
  const cats = (d.cats || []).slice(0, 6);
  for (let r = 0; r < 2; r++) {
    const row = right.addStack();
    cats.slice(r * 3, r * 3 + 3).forEach((c, i) => { if (i) row.addSpacer(); catButton(row, c); });
    if (r === 0) right.addSpacer(6);
  }
  if (fam === "large") {
    w.addSpacer(14);
    text(w, "Top spending · " + MON[+d.month.slice(5, 7) - 1], 12, MUTED, true);
    w.addSpacer(6);
    (d.top || []).forEach(t => {
      const row = w.addStack();
      row.centerAlignContent();
      const ic = row.addStack();
      ic.size = new Size(30, 30); ic.cornerRadius = 15; ic.backgroundColor = CHIP; ic.centerAlignContent();
      text(ic, t.icon, 15);
      row.addSpacer(10);
      const col = row.addStack();
      col.layoutVertically();
      const r1 = col.addStack();
      text(r1, t.label, 13, TEXT, true);
      r1.addSpacer();
      text(r1, fmt(t.amount), 13, TEXT, true);
      col.addSpacer(3);
      const im = col.addImage(barImage(250, d.spentMTD ? t.amount / d.spentMTD : 0, 0, GREEN));
      im.imageSize = new Size(250, 12);
      w.addSpacer(8);
    });
    w.addSpacer();
    const inc = w.addStack();
    text(inc, "Income this month", 12, MUTED);
    inc.addSpacer();
    text(inc, fmt(d.incomeMTD), 12, new Color("#3B8BFF"), true);
  }
  return w;
}

// Bấm widget → mở màn nhập của app (giống Money Lover: bàn phím + − × ÷, nhóm hay dùng, ví, ngày) ngay trong Scriptable.
// Key được ghi vào localStorage của WebView trước khi mở app, nên không bị hỏi key.
async function openAdd(key, cat) {
  const wv = new WebView();
  await wv.loadURL(APP + "manifest.webmanifest");            // cùng origin với app → ghi được localStorage
  await wv.evaluateJavaScript("localStorage.setItem('exp_key', " + JSON.stringify(key) + "); true");
  wv.loadURL(APP + "?add=1&embed=1" + (cat ? "&cat=" + encodeURIComponent(cat) : "") + "&_=" + Date.now());
  await wv.present(true);
  // App lưu kiểu lạc quan rồi gửi ở nền. Đóng màn hình mà script kết thúc ngay thì WebView bị huỷ, lời gọi chưa xong bị bỏ
  // → giao dịch kẹt trong máy, app và Sheet không thấy. Giữ script chạy tới khi hàng chờ trống (tối đa ~90 giây).
  const pending = async () => {
    try { return Number(await wv.evaluateJavaScript("(JSON.parse(localStorage.getItem('exp_outbox') || '[]')).length")) || 0; }
    catch (e) { return 0; }
  };
  let n = await pending();
  for (let i = 0; n > 0 && i < 45; i++) {
    await new Promise(r => Timer.schedule(2000, false, r));
    n = await pending();
  }
  if (n > 0) {
    const no = new Notification();
    no.title = "Expenses";
    no.body = n + " transaction(s) not saved yet — tap to open and send again.";
    no.openURL = URLScheme.forRunningScript() + "?action=add";
    await no.schedule();
  }
}

async function menu() {
  const a = new Alert();
  a.title = "Expenses widget";
  a.addAction("Choose background photo");
  if (HAS_PHOTO) a.addAction("Remove photo");
  a.addAction("Preview small");
  a.addAction("Preview medium");
  a.addAction("Preview large");
  a.addCancelAction("Close");
  const i = await a.present();
  const off = HAS_PHOTO ? 1 : 0;
  if (i === 0) { try { FM.writeImage(BG_PATH, await Photos.fromLibrary()); } catch (e) {} return "medium"; }
  if (HAS_PHOTO && i === 1) { FM.remove(BG_PATH); return "medium"; }
  return ["small", "medium", "large"][i - 1 - off] || null;
}

const qp = args.queryParameters || {};
if (qp.action === "add" && Keychain.contains(KC)) {
  await openAdd(Keychain.get(KC), qp.cat || "");
} else if (config.runsInWidget) {
  Script.setWidget(await build());
} else {
  const size = Keychain.contains(KC) ? await menu() : "medium";
  if (size) {
    const widget = await build(size);
    if (size === "small") await widget.presentSmall();
    else if (size === "large") await widget.presentLarge();
    else await widget.presentMedium();
  }
}
Script.complete();
