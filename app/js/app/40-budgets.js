// AificoApp methods: budgets. Part of the AificoApp prototype chain.
// A budget is a monthly limit on a category (data.budgets: { category: limit }) or on one of its subcategories
// (data.subBudgets: { category: { subcategory: limit } }). A category with only subcategory budgets counts as their sum;
// spending in its other subcategories shows as "Other in …" so nothing goes uncounted. Options per budget (data.budgetMeta,
// keyed "Category" or "Category › Subcategory"): period "year" (category budgets: a limit for the calendar year, e.g.
// insurance or school fees) and rollover (monthly budgets: what was left last month is added to this month).
        class AificoAppBudgets extends AificoAppAccounts {
            subBudgets(){ const s = this.data.subBudgets; if (!s || typeof s !== 'object' || Array.isArray(s)) this.data.subBudgets = {}; return this.data.subBudgets; }
            /** Counted spending in a category (and optionally one subcategory) between two ISO dates, inclusive. */
            budgetSpent(cat, sub, from, to){
                return this.countedTx().filter(t => { if (!this.isSpending(t)) return false; const d = this.normalizeLedgerDate ? this.normalizeLedgerDate(t.date) : t.date;
                    return d >= from && d <= to && (this.spendingCategory ? this.spendingCategory(t) : t.category) === cat && (sub == null || (t.subcategory || '') === sub); })
                    .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0);
            }
            budgetMeta(){ const m = this.data.budgetMeta; if (!m || typeof m !== 'object' || Array.isArray(m)) this.data.budgetMeta = {}; return this.data.budgetMeta; }
            budgetKey(cat, sub){ return sub ? `${cat} › ${sub}` : cat; }
            budgetYear(){ const y = new Date().getFullYear(); return [`${y}-01-01`, `${y}-12-31`]; }
            /** A monthly budget with carry-over: last month's unused part of the limit (never negative). */
            budgetCarry(cat, sub, limit){ if (!this.budgetMeta()[this.budgetKey(cat, sub)]?.rollover || !(limit > 0)) return 0; const [f, t] = this.budgetMonth(-1); return Math.max(0, Math.round(limit - this.budgetSpent(cat, sub, f, t))); }
            budgetMonth(offset = 0){ const n = new Date(), d = new Date(n.getFullYear(), n.getMonth() + offset, 1), e = new Date(d.getFullYear(), d.getMonth() + 1, 0), iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; return [iso(d), iso(e)]; }
            /** Average monthly spending over the last 3 full months: the suggested limit. */
            budgetAverage(cat, sub){ let s = 0; for (let i = 1; i <= 3; i++) { const [f, t] = this.budgetMonth(-i); s += this.budgetSpent(cat, sub, f, t); } return Math.round(s / 3); }
            /** One group per budgeted category: its own limit and/or its subcategory budgets, with this month's spending. */
            budgetGroups(){
                const [from, to] = this.budgetMonth(0), subs = this.subBudgets();
                const cats = [...new Set([...Object.keys(this.data.budgets || {}), ...Object.keys(subs).filter(c => Object.keys(subs[c] || {}).length)])];
                return cats.map(cat => {
                    const own = Object.prototype.hasOwnProperty.call(this.data.budgets || {}, cat) ? Number(this.data.budgets[cat]) || 0 : null;
                    const yearly = own != null && this.budgetMeta()[cat]?.period === 'year', [yf, yt] = yearly ? this.budgetYear() : [from, to];
                    const subRows = Object.entries(subs[cat] || {}).map(([sub, limit]) => { const base = Number(limit) || 0, carry = this.budgetCarry(cat, sub, base); return { sub, base, carry, limit: base + carry, spent: this.budgetSpent(cat, sub, from, to) }; });
                    const monthSpent = this.budgetSpent(cat, null, from, to), spent = yearly ? this.budgetSpent(cat, null, yf, yt) : monthSpent, subLimits = subRows.reduce((a, r) => a + r.base, 0);
                    const carry = own != null && !yearly ? this.budgetCarry(cat, null, own) : 0, limit = own != null ? own + carry : subRows.reduce((a, r) => a + r.limit, 0);
                    return { cat, own, yearly, carry, subs: subRows, spent, limit, monthly: yearly ? Math.round(own / 12) : (own ?? subLimits), subLimits,
                        other: subRows.length ? monthSpent - subRows.reduce((a, r) => a + r.spent, 0) : 0, over: own != null && subLimits * (yearly ? 12 : 1) > own };
                });
            }
            budgetTotal(){ return this.budgetGroups().reduce((a, g) => a + g.monthly, 0); }
            /** Budgets at 80% or more this month, for the Dashboard's Needs attention list. */
            budgetAlerts(){ const out = []; this.budgetGroups().forEach(g => { const chk = (name, spent, limit) => { if (limit > 0 && spent / limit >= 0.8) out.push({ name, pct: Math.round(spent / limit * 100) }); }; chk(g.cat, g.spent, g.limit); g.subs.forEach(r => chk(`${g.cat} › ${r.sub}`, r.spent, r.limit)); }); return out.sort((a, b) => b.pct - a.pct); }

            renderBudgets() {
                const container = document.getElementById('budgets-container'); if (!container) return;
                const esc = v => this.escapeHtml(String(v ?? '')), money = v => `${CUR()}${Math.round(v).toLocaleString('en-IN')}`;
                // Take-home from the salary schedule: the total allocation is compared with it
                const takeHome = Number(this.data.salarySchedule?.amount) || Number(this.data.settings?.monthlyTakeHomeSalary) || 0;
                const groups = this.budgetGroups(), total = groups.reduce((a, g) => a + g.monthly, 0);
                const allocPct = takeHome > 0 ? Math.round(total / takeHome * 100) : null;
                const bar = (spent, limit, small) => { const pct = limit > 0 ? Math.round(spent / limit * 100) : (spent > 0 ? 101 : 0); const tone = pct > 100 ? 'bg-rose-600' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-600';
                    return { pct, html: `<div class="w-full bg-slate-200 dark:bg-slate-700 ${small ? 'h-1.5' : 'h-2.5'} rounded-full overflow-hidden"><div class="${tone} ${small ? 'h-1.5' : 'h-2.5'} rounded-full" style="width:${Math.min(pct, 100)}%"></div></div>` }; };
                const used = (spent, limit) => { if (!(limit > 0)) return ''; const pct = Math.round(spent / limit * 100), tone = pct > 100 ? 'text-rose-600 dark:text-rose-400' : pct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400';
                    return `<span class="${tone}">${pct}% used · ${pct > 100 ? 'over by ' + money(spent - limit) : money(limit - spent) + ' left'}</span>`; };
                const act = (cat, sub) => `<button type="button" class="bd-act" onclick='app.editBudget(${JSON.stringify(cat)},${JSON.stringify(sub)})' aria-label="Edit budget"><i data-lucide="pencil"></i></button><button type="button" class="bd-act bd-del" onclick='app.deleteBudget(${JSON.stringify(cat)},${JSON.stringify(sub)})' aria-label="Delete budget"><i data-lucide="trash-2"></i></button>`;
                const summary = `<div class="p-4 mb-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 space-y-2">
                    <div class="flex flex-wrap justify-between items-center gap-2"><span class="font-semibold text-sm">Total budget allocation</span><span class="text-sm font-bold ${allocPct > 100 ? 'text-rose-700 dark:text-rose-300' : ''}">${money(total)} / ${money(takeHome)} (${allocPct === null ? '—' : allocPct + '%'})</span></div>
                    <div class="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden"><div class="${allocPct > 100 ? 'bg-rose-600' : 'bg-indigo-600'} h-2.5 rounded-full" style="width:${Math.min(allocPct || 0, 100)}%"></div></div>
                    <p class="text-xs text-slate-600 dark:text-slate-300">Your budgets added up, against your monthly take-home. Each card compares this month's spending with its limit; subcategory budgets sit under their category.</p></div>`;
                const empty = groups.length ? '' : `<div class="bd-empty"><p>No budgets yet. Set one for a category, or for a single subcategory such as Food &amp; Dining › Restaurants.</p><button type="button" class="s-btn s-primary" onclick="app.openBudgetModal()"><i data-lucide="plus"></i><span>Set Budget</span></button></div>`;
                container.innerHTML = summary + empty + groups.map(g => {
                    const b = bar(g.spent, g.limit), share = takeHome > 0 && g.monthly > 0 ? `<span class="text-slate-500 dark:text-slate-400">${Math.round(g.monthly / takeHome * 100)}% of take-home${g.yearly ? ' a month' : ''}</span>` : '';
                    const extra = (g.yearly ? `<div class="bd-note">Yearly budget: spending from 1 January to today</div>` : '') + (g.carry ? `<div class="bd-note">Includes ${money(g.carry)} left over from last month</div>` : '');
                    const head = g.own != null ? act(g.cat, null) : `<span class="bd-tag">Sum of subcategories</span>`;
                    const subs = g.subs.map(r => { const sb = bar(r.spent, r.limit, true); return `<div class="bd-sub"><div class="bd-row"><span class="bd-sname">${esc(r.sub)}</span><span class="bd-fig">${money(r.spent)} / ${money(r.limit)}</span>${act(g.cat, r.sub)}</div>${sb.html}<div class="bd-note">${used(r.spent, r.limit)}${r.carry ? ` · includes ${money(r.carry)} left over` : ''}</div></div>`; }).join('');
                    const other = g.subs.length && g.other > 0.5 ? `<div class="bd-sub bd-other"><div class="bd-row"><span class="bd-sname">Other in ${esc(g.cat)}</span><span class="bd-fig">${money(g.other)}</span></div><div class="bd-note">Spending in subcategories without their own budget</div></div>` : '';
                    const warn = g.over ? `<div class="bd-warn">Subcategory budgets (${money(g.subLimits)}) add up to more than the ${esc(g.cat)} budget (${money(g.own)}).</div>` : '';
                    return `<div class="bd-card p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div class="bd-row"><span class="cat-name"><i class="cat-dot" style="--c:${this.categoryColor(g.cat)}"></i>${esc(g.cat)}</span><span class="bd-fig">${money(g.spent)} / ${money(g.limit)}${g.yearly ? '<small> /yr</small>' : ''}</span>${head}</div>
                        ${b.html}<div class="flex flex-wrap justify-between gap-2 text-xs">${used(g.spent, g.limit)}${share}</div>${extra}${warn}${subs}${other}</div>`;
                }).join('');
                window.lucide?.createIcons?.();
            }

            /** Set or edit a budget: category, then "All of it" or one subcategory, then the monthly limit (with a suggestion). */
            openBudgetModal(edit = null) {
                if (!edit || !edit.cat) edit = null;   // also called straight from buttons (with a click event)
                const esc = v => this.escapeHtml(String(v ?? '')), subsMap = this.categorySubcategoryMap();
                const cats = [...new Set([...(this.data.categories || []).filter(c => !/^(transfer|uncategori[sz]ed)$/i.test(c)), ...(edit ? [edit.cat] : [])])];
                const cur = edit ? (edit.sub ? this.subBudgets()[edit.cat]?.[edit.sub] : this.data.budgets?.[edit.cat]) : '';
                const box = document.getElementById('modal-box');
                box.innerHTML = `<div class="flex items-center justify-between pb-2"><h3 class="font-bold text-lg">${edit ? 'Edit budget' : 'Set Monthly Budget'}</h3><button type="button" onclick="app.closeModal()" aria-label="Close" class="text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button></div>
                  <form id="bd-form" class="ip-form" autocomplete="off" novalidate>
                    <label class="ip-field"><span>Category</span><select id="bd-cat">${cats.map(c => `<option value="${esc(c)}" ${edit && c === edit.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
                    <label class="ip-field"><span>Subcategory</span><select id="bd-sub"></select></label>
                    <label class="ip-field"><span>Monthly limit${CURL()}</span><input id="bd-amount" type="text" inputmode="decimal" value="${cur ? esc(cur) : ''}" placeholder="0"></label>
                    <label class="ip-field" id="bd-period-row"><span>Period</span><select id="bd-period"><option value="month">Every month</option><option value="year">Every year (e.g. insurance, school fees)</option></select></label>
                    <label class="set-check" id="bd-roll-row"><input type="checkbox" id="bd-roll"> <span>Carry over what's left at the end of each month</span></label>
                    <div id="bd-suggest" class="bd-suggest" role="status" aria-live="polite"></div>
                    <p id="bd-err" class="bd-err" role="alert"></p>
                    <div class="af-actions"><button type="button" class="s-btn s-secondary" onclick="app.closeModal()">Cancel</button><button type="submit" class="s-btn s-primary">${edit ? 'Save budget' : 'Set budget'}</button></div>
                  </form>`;
                const cat = box.querySelector('#bd-cat'), sub = box.querySelector('#bd-sub'), amt = box.querySelector('#bd-amount'), sug = box.querySelector('#bd-suggest'), err = box.querySelector('#bd-err');
                const per = box.querySelector('#bd-period'), roll = box.querySelector('#bd-roll'); const meta0 = edit ? this.budgetMeta()[this.budgetKey(edit.cat, edit.sub)] || {} : {};
                per.value = meta0.period === 'year' ? 'year' : 'month'; roll.checked = !!meta0.rollover;
                const opts = () => { const whole = !sub.value; box.querySelector('#bd-period-row').hidden = !whole; if (!whole) per.value = 'month'; box.querySelector('#bd-roll-row').hidden = per.value === 'year'; if (per.value === 'year') roll.checked = false;
                    box.querySelector('label[for], #bd-amount')?.closest('label')?.querySelector('span')?.replaceChildren(document.createTextNode((per.value === 'year' ? 'Yearly limit' : 'Monthly limit') + CURL())); };
                const fillSubs = keep => { const list = subsMap[cat.value] || []; sub.innerHTML = `<option value="">All of ${esc(cat.value)}</option>` + list.map(s => `<option value="${esc(s)}" ${keep === s ? 'selected' : ''}>${esc(s)}</option>`).join(''); sub.disabled = !list.length; };
                const suggest = () => { opts(); const s = sub.value || null, yr = per.value === 'year', avg = this.budgetAverage(cat.value, s) * (yr ? 12 : 1);
                    sug.innerHTML = avg > 0 ? `You spent about <b>${CUR()}${avg.toLocaleString('en-IN')}</b> ${yr ? 'a year (3-month average × 12)' : 'a month'} on ${esc(s ? cat.value + ' › ' + s : cat.value)} over the last 3 months. <button type="button" class="bd-use">Use it</button>` : `No spending on ${esc(s ? cat.value + ' › ' + s : cat.value)} in the last 3 months.`;
                    sug.querySelector('.bd-use')?.addEventListener('click', () => { amt.value = String(avg); err.textContent = ''; amt.focus(); }); };
                fillSubs(edit?.sub || ''); suggest();
                cat.addEventListener('change', () => { fillSubs(''); suggest(); }); sub.addEventListener('change', suggest); per.addEventListener('change', suggest);
                amt.addEventListener('input', () => { err.textContent = ''; });
                box.querySelector('#bd-form').addEventListener('submit', e => { e.preventDefault();
                    let amount = 0; try { const v = String(amt.value).replace(/,/g, '').trim(); amount = !v ? 0 : this.calculateAmountExpression ? Number(this.calculateAmountExpression(v)) : Number(v); } catch (x) { amount = NaN; }
                    const c = cat.value, s = sub.value || null;
                    if (!(amount > 0)) { err.textContent = 'Enter a monthly limit greater than zero.'; amt.focus(); return; }
                    const exists = s ? this.subBudgets()[c]?.[s] != null : Object.prototype.hasOwnProperty.call(this.data.budgets || {}, c);
                    const same = edit && edit.cat === c && (edit.sub || null) === s;
                    if (exists && !same) { err.textContent = `${s ? c + ' › ' + s : c} already has a budget. Edit that one instead.`; return; }
                    if (edit) this.removeBudget(edit.cat, edit.sub);
                    if (s) { const m = this.subBudgets(); (m[c] ||= {})[s] = amount; } else { this.data.budgets ||= {}; this.data.budgets[c] = amount; }
                    { const meta = this.budgetMeta(), k = this.budgetKey(c, s), o = {}; if (!s && per.value === 'year') o.period = 'year'; if (per.value !== 'year' && roll.checked) o.rollover = true; if (Object.keys(o).length) meta[k] = o; else delete meta[k]; }
                    this.saveVault(); this.renderAll(); this.closeModal();
                });
                document.getElementById('modal-container').classList.remove('hidden'); window.lucide?.createIcons?.(); setTimeout(() => amt.focus(), 50);
            }
            editBudget(category, sub = null) { this.openBudgetModal({ cat: category, sub: sub || null }); }
            removeBudget(cat, sub){ delete this.budgetMeta()[this.budgetKey(cat, sub)]; if (sub) { const m = this.subBudgets(); if (m[cat]) { delete m[cat][sub]; if (!Object.keys(m[cat]).length) delete m[cat]; } } else if (this.data.budgets) delete this.data.budgets[cat]; }
            async deleteBudget(category, sub = null) {
                const name = sub ? `${category} › ${sub}` : category;
                if (!await this.uiConfirm(`Delete the budget for "${name}"? Transactions and category history will not be deleted.`)) return;
                this.removeBudget(category, sub); this.saveVault(); this.renderAll();
            }
        }
