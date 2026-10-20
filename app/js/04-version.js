// The app's version, in one place: v<major>.<YYMM>.<change>, e.g. 1.2610.85 = October 2026, change 85.
// The change number starts again at 1 each month; major goes up only when old data or backups need converting.
// Raise it with tools/bump-version.ps1 before each release (push, published site, APK or AAB). The labels in the app,
// the User Guide, Lite and both Android builds (versionName and versionCode) all read it from here.
window.AIFICO_VERSION = '1.2610.90';
window.aificoVersion = function () {
  const [major, yymm, change] = String(window.AIFICO_VERSION).split('.');
  const month = new Date(2000 + Number(yymm.slice(0, 2)), Number(yymm.slice(2)) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return { label: 'v' + window.AIFICO_VERSION, major: Number(major), yymm, change: Number(change), month, detail: `${month} · Change ${Number(change)}` };
};
