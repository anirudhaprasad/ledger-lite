// Display currency. The symbol is a per-vault setting (Backup & Settings → Currency), so it travels with backups.
// CUR()  → the symbol to put in front of an amount: '₹', '$', 'Rs ' (letters get a trailing space), or '' for none.
// CURL() → a field-label suffix: ' (₹)', ' (Rs)', or '' for none.
// Amount parsing and stored data are not affected; only what is shown changes.
const AIFICO_DEFAULT_CURRENCY = '₹';
function aificoCurrencySymbol() {
    try {
        const s = (typeof app !== 'undefined' && app.data && app.data.settings) ? app.data.settings.currencySymbol : undefined;
        return s === undefined || s === null ? AIFICO_DEFAULT_CURRENCY : String(s);
    } catch (e) { return AIFICO_DEFAULT_CURRENCY; }
}
function CUR() { const s = aificoCurrencySymbol(); return /[A-Za-z]$/.test(s) ? s + ' ' : s; }
function CURL() { const s = aificoCurrencySymbol(); return s ? ' (' + s + ')' : ''; }
// Static page text marks currency spots with data-cur (symbol) or data-cur-label (label suffix).
function aificoApplyCurrencyToPage(root) {
    (root || document).querySelectorAll('[data-cur]').forEach(e => { e.textContent = CUR(); });
    (root || document).querySelectorAll('[data-cur-label]').forEach(e => { e.textContent = CURL(); });
}
