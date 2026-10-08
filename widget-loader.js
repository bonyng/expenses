// Expenses widget — LOADER. Dán file này vào Scriptable 1 lần duy nhất (đặt tên script: Expenses).
// Mỗi lần chạy: tải bản widget mới nhất từ GitHub Pages; mất mạng/lỗi thì dùng bản đã lưu lần trước.
// Cập nhật widget sau này chỉ cần push widget.js lên repo — không phải dán lại.
const CODE_URL = "https://bonyng.github.io/expenses/widget.js";
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), "expenses-widget-core.js");

let code = null;
try {
  const r = new Request(CODE_URL + "?t=" + Date.now());
  r.timeoutInterval = 8;
  const s = await r.loadString();
  // Chỉ nhận đúng file widget (tránh lưu nhầm trang lỗi HTML).
  if (r.response && r.response.statusCode === 200 && s.startsWith("// Expenses widget for Scriptable")) {
    code = s;
    fm.writeString(cachePath, s);
  }
} catch (e) { /* mất mạng → dùng bản đã lưu */ }
if (!code && fm.fileExists(cachePath)) code = fm.readString(cachePath);
if (!code) throw new Error("Can't download the widget code. Check the internet connection and run again.");

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction(code)();
