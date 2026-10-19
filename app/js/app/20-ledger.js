// AificoApp methods: ledger (37 methods). Part of the AificoApp prototype chain.
        class AificoAppLedger extends AificoAppCategories {
            // ---------- Statement reconciliation: the statement confirms what the app already recorded ----------
            /**
             * Returns or checks is locked date.
             * Parameters: date. Side effects, if any, are described by the statements below.
             */
            isLockedDate(date){ const m=String(this.parseLedgerDate?.(date)||date||'').slice(0,7); return !!m&&(this.data?.lockedMonths||[]).includes(m); }
            /**
             * Handles the locked alert workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: date. Side effects, if any, are described by the statements below.
             */
            lockedAlert(date){ alert(`${String(this.parseLedgerDate?.(date)||date).slice(0,7)} is locked after reconciliation. Unlock it in Backup & Settings → Reconciliation to change entries in that month.`); }
            // ---------- Core Ledger header: what stays pinned, and where filters go ----------
            /**
             * Handles the ledger header prefs workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: ){ const d={pin:true,filters:'auto',count:true,totals:['income','expense','transfer','net']}; try{ return {...d,...JSON.parse(localStorage.getItem('aifico_ledger_header')||'{}')}; }catch(e. Side effects, if any, are described by the statements below.
             */
            ledgerHeaderPrefs(){ const d={pin:true,filters:'auto',count:true,totals:['income','expense','transfer','net']}; try{ return {...d,...JSON.parse(localStorage.getItem('aifico_ledger_header')||'{}')}; }catch(e){ return d; } }
            /**
             * Handles the ledger active filters workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            ledgerActiveFilters(){
                const v=id=>document.getElementById(id)?.value||''; const out=[];
                const type=v('ledger-filter-type'); if(type)out.push({id:'ledger-filter-type',label:type,reset:''});
                const year=v('ledger-filter-year'); if(year)out.push({id:'ledger-filter-year',label:year,reset:''});
                const from=v('ledger-date-from'); if(from)out.push({id:'ledger-date-from',label:'From '+from,reset:''});
                const to=v('ledger-date-to'); if(to)out.push({id:'ledger-date-to',label:'To '+to,reset:''});
                const st=v('ledger-excluded-filter'); if(st&&st!=='active'){ const el=document.getElementById('ledger-excluded-filter'); out.push({id:'ledger-excluded-filter',label:el.options[el.selectedIndex]?.text||st,reset:'active'}); }
                return out;
            }
            /**
             * Handles the clear ledger filter workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id,reset){ const el=document.getElementById(id); if(el. Side effects, if any, are described by the statements below.
             */
            clearLedgerFilter(id,reset){ const el=document.getElementById(id); if(el){ el.value=reset||''; } this.filterLedger(); }
            /**
             * Changes the ledger filters and refreshes dependent UI.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            toggleLedgerFilters(){ this.ledgerFiltersOpen=!this.ledgerFiltersIsOpen(); this.applyLedgerHeader(); }
            /**
             * Handles the ledger filters is open workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            ledgerFiltersIsOpen(){ const p=this.ledgerHeaderPrefs(); if(p.filters==='always')return true; if(p.filters==='button')return !!this.ledgerFiltersOpen; const wide=(document.getElementById('panel-ledger')?.clientWidth||0)>760; return this.ledgerFiltersOpen===undefined?wide:!!this.ledgerFiltersOpen; }
            /**
             * Handles the apply ledger header workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            applyLedgerHeader(){
                const box=document.getElementById('ledger-sticky'); if(!box)return; const p=this.ledgerHeaderPrefs();
                box.classList.toggle('lh-unpinned',!p.pin);
                const open=this.ledgerFiltersIsOpen(); const f=document.getElementById('ledger-filters'); if(f)f.hidden=!open;
                const tg=document.getElementById('ledger-filter-toggle'); if(tg){ tg.setAttribute('aria-expanded',String(open)); tg.hidden=p.filters==='always'; tg.classList.toggle('on',open); }
                const act=this.ledgerActiveFilters(); const badge=document.getElementById('ledger-filter-badge'); if(badge){ badge.hidden=!act.length; badge.textContent=act.length; }
                const chips=document.getElementById('ledger-chips'); if(chips){ chips.innerHTML=open?'':act.map(a=>`<button type="button" class="lh-chip" onclick="app.clearLedgerFilter('${a.id}','${a.reset}')" aria-label="Remove filter ${this.escapeHtml(a.label)}">${this.escapeHtml(a.label)} <span aria-hidden="true">✕</span></button>`).join(''); chips.hidden=open||!act.length; }
                const cnt=document.getElementById('ledger-total-count'); if(cnt)cnt.hidden=!p.count;
                const map={income:'ledger-total-income',expense:'ledger-total-expense',transfer:'ledger-total-transfer',net:'ledger-total-net'}; let shown=0;
                Object.entries(map).forEach(([k,id])=>{ const cell=document.getElementById(id)?.parentElement; if(cell){ const on=p.totals.includes(k); cell.hidden=!on; if(on)shown++; } });
                const tot=document.getElementById('ledger-totals'); if(tot){ tot.hidden=!shown; tot.style.setProperty('--lh-cols',Math.max(1,shown)); tot.style.setProperty('--lh-cols-sm',Math.min(2,Math.max(1,shown))); }
            }
            /**
             * Opens the  ledger header settings screen, dialog, or workflow.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            openLedgerHeaderSettings(){
                const p=this.ledgerHeaderPrefs(); const box=document.getElementById('modal-box');
                const cb=(name,label,on)=>`<label class="lh-opt"><input type="checkbox" name="${name}" ${on?'checked':''}><span>${label}</span></label>`;
                box.innerHTML=`<div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3"><h3 class="font-bold text-lg">Core Ledger header</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                <form id="lh-form" class="ip-form">
                  ${cb('pin','Keep search and totals at the top while scrolling',p.pin)}
                  <label class="ip-field"><span>Filters (type, year, dates, status)</span><select name="filters"><option value="auto" ${p.filters==='auto'?'selected':''}>Auto: open on wide screens, behind the Filters button on phones</option><option value="button" ${p.filters==='button'?'selected':''}>Behind the Filters button</option><option value="always" ${p.filters==='always'?'selected':''}>Always shown</option></select></label>
                  <fieldset class="ip-fieldset"><legend>Show at the top</legend>${cb('count','Number of transactions',p.count)}${cb('t_income','Income',p.totals.includes('income'))}${cb('t_expense','Expenses',p.totals.includes('expense'))}${cb('t_transfer','Transfers',p.totals.includes('transfer'))}${cb('t_net','Net',p.totals.includes('net'))}</fieldset>
                  <p class="ip-hint">Saved on this device. Filters that are on show as small chips you can tap to remove.</p>
                  <div class="ip-form-actions"><button type="button" class="s-btn s-secondary" onclick="app.closeModal()">Cancel</button><button type="submit" class="s-btn s-primary">Save</button></div></form>`;
                document.getElementById('modal-container').classList.remove('hidden');
                document.getElementById('lh-form').addEventListener('submit',e=>{ e.preventDefault(); const f=e.target; const on=n=>f.querySelector(`[name=${n}]`).checked;
                    const totals=['income','expense','transfer','net'].filter(k=>on('t_'+k)); this.ledgerFiltersOpen=undefined;
                    this.saveLedgerHeaderPrefs({pin:on('pin'),filters:f.querySelector('[name=filters]').value,count:on('count'),totals}); this.closeModal(); });
            }
            // Day headers like a passbook: date, weekday and that day's income and spending.
            /**
             * Handles the ledger rows with day headers workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: list,rowFn. Side effects, if any, are described by the statements below.
             */
            ledgerRowsWithDayHeaders(list,rowFn){
                const sort=document.getElementById('ledger-sort-date')?.value||'desc';
                if(!['desc','asc'].includes(sort))return list.map(rowFn).join('');
                const money=v=>'₹'+(Number(v)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
                const key=t=>(this.parseLedgerDate(t.date)||String(t.date||'')).slice(0,10);
                const totals=new Map(); list.forEach(t=>{ if(t.excludedFromLedger)return; const k=key(t); const o=totals.get(k)||{inc:0,exp:0}; const a=Number(t.amount)||0; if(t.type==='Income')o.inc+=a; else if(['Expense','EMI','Installment'].includes(t.type))o.exp+=a; totals.set(k,o); });
                let last=null, out='';
                for(const t of list){ const k=key(t);
                    if(k!==last){ last=k; const m=k.match(/^(\d{4})-(\d{2})-(\d{2})$/); const o=totals.get(k)||{inc:0,exp:0};
                        const dow=m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3])).toLocaleDateString('en-IN',{weekday:'short',timeZone:'UTC'}):'';
                        out+=`<tr class="ledger-day"><td colspan="8"><div class="ld"><span class="ld-day">${m?m[3]:this.escapeHtml(k||'No date')}</span>${m?`<span class="ld-dow">${dow}</span><span class="ld-my">${m[2]}.${m[1]}</span>`:''}<span class="ld-sp"></span>${o.inc?`<span class="ld-in">${money(o.inc)}</span>`:''}${o.exp?`<span class="ld-out">${money(o.exp)}</span>`:''}</div></td></tr>`; }
                    out+=rowFn(t); }
                return out;
            }
            /**
             * Returns or checks  filtered ledger.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            getFilteredLedger() {
                const search = document.getElementById('ledger-search')?.value.toLowerCase() || '';
                const typeFilter = document.getElementById('ledger-filter-type')?.value || '';
                const yearFilter=document.getElementById('ledger-filter-year')?.value||'';
                const monthFilter=document.getElementById('ledger-filter-month')?.value||'';
                const fromDate=document.getElementById('ledger-date-from')?.value||'';
                const toDate=document.getElementById('ledger-date-to')?.value||'';
                const sortOrder=document.getElementById('ledger-sort-date')?.value||'desc';
                const excludedMode=document.getElementById('ledger-excluded-filter')?.value||'active';
                return (this.data?.tx||[]).filter(t => {
                    const isExcluded=!!t.excludedFromLedger;
                    if(excludedMode==='active' && isExcluded) return false;
                    if(excludedMode==='excluded' && !isExcluded) return false;
                    if(excludedMode==='duplicates' && !t.duplicateOf) return false;
                    const haystack = [t.payee,t.notes,t.note,t.description,t.category,t.subcategory,t.account,t.date].map(v=>String(v||'').toLowerCase()).join(' ');
                    const matchSearch = haystack.includes(search);
                    const matchType = typeFilter ? t.type === typeFilter : true;
                    const iso=this.normalizeLedgerDate(t.date);
                    const matchYear=!yearFilter||iso.slice(0,4)===yearFilter;
                    const matchMonth=!monthFilter||iso.slice(5,7)===monthFilter;
                    const matchFrom=!fromDate||iso>=fromDate;
                    const matchTo=!toDate||iso<=toDate;
                    return matchSearch && matchType && matchYear && matchMonth && matchFrom && matchTo;
                }).sort((a,b)=>{const cmpText=(x,y)=>String(x??'').trim().localeCompare(String(y??'').trim(),undefined,{sensitivity:'base',numeric:true});if(sortOrder.startsWith('payee-')){const c=cmpText(a.payee||a.description||a.notes||a.note,b.payee||b.description||b.notes||b.note);return sortOrder.endsWith('desc')?-c:c;}if(sortOrder.startsWith('type-')){const c=cmpText(a.type,b.type);return sortOrder.endsWith('desc')?-c:c;}if(sortOrder.startsWith('category-')){const c=cmpText(a.category,b.category);return sortOrder.endsWith('desc')?-c:c;}if(sortOrder.startsWith('account-')){const c=cmpText(a.account,b.account);return sortOrder.endsWith('desc')?-c:c;}if(sortOrder.startsWith('amount-')){const c=(Number(a.amount)||0)-(Number(b.amount)||0);return sortOrder.endsWith('desc')?-c:c;}const da=this.normalizeLedgerDate(a.date),db=this.normalizeLedgerDate(b.date);if(!da&&!db)return 0;if(!da)return 1;if(!db)return -1;return sortOrder==='asc'?da.localeCompare(db):db.localeCompare(da);});
            }

            /**
             * Updates ledger exclusion.
             * Parameters: tx,exclude. Side effects, if any, are described by the statements below.
             */
            setLedgerExclusion(tx,exclude){
                if(!tx||!!tx.excludedFromLedger===exclude)return false;
                if(exclude){tx.excludedFromLedger=true;return true;}
                tx.excludedFromLedger=false;
                if(tx.balanceEffectRemoved){this.applyBalanceEffect(tx,1);delete tx.balanceEffectRemoved;}
                if(tx.duplicateOf){tx.duplicateOverride=true;delete tx.duplicateOf;delete tx.duplicateReason;delete tx.duplicateMarkedAt;}
                return true;
            }
            // When the actual transaction is deleted, its SMS duplicates are no longer duplicates of anything.
            /**
             * Handles the release duplicates of workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: ids. Side effects, if any, are described by the statements below.
             */
            async releaseDuplicatesOf(ids){
                const set=new Set((ids||[]).map(String));
                const orphans=(this.data.tx||[]).filter(t=>t.duplicateOf&&set.has(String(t.duplicateOf)));
                if(!orphans.length)return 0;
                if(!await this.uiConfirm(`${orphans.length} SMS entr${orphans.length===1?'y was':'ies were'} marked as duplicate of the deleted transaction.\n\nRestore ${orphans.length===1?'it':'them'} so the transaction is still counted? Choose Cancel to keep ${orphans.length===1?'it':'them'} excluded.`))return 0;
                orphans.forEach(t=>{t.excludedFromLedger=false;if(t.balanceEffectRemoved){this.applyBalanceEffect(t,1);delete t.balanceEffectRemoved;}delete t.duplicateOf;delete t.duplicateReason;delete t.duplicateMarkedAt;});
                this.autoFlagSmsDuplicates();
                return orphans.length;
            }

            /**
             * Handles the counted tx workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            countedTx() { return (this.data?.tx||[]).filter(t=>t&&!t.excludedFromLedger); }

            /**
             * Renders the  ledger UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderLedger() {
                this.populateLedgerYears();
                try { this.computeCardStatusMap(); } catch (e) { this.cardStatusMap = new Map(); }
                try { this.applyLedgerHeader(); } catch (e) {}
                setTimeout(()=>{ try{ this.syncHeadSelect(); this.renderPageTitle(); }catch(e){} },0);
                const tbody = document.getElementById('ledger-tbody');
                const filtered = this.getFilteredLedger();
                const money=v=>'₹'+(Number(v)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
                const income=filtered.filter(t=>t.type==='Income').reduce((sum,t)=>sum+(Number(t.amount)||0),0);
                const expense=filtered.filter(t=>['Expense','EMI','Installment'].includes(t.type)).reduce((sum,t)=>sum+(Number(t.amount)||0),0);
                const transfers=filtered.filter(t=>t.type==='Transfer').reduce((sum,t)=>sum+(Number(t.amount)||0),0);
                const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
                setText('ledger-total-count',filtered.length.toLocaleString('en-IN'));
                setText('ledger-total-income',money(income));
                setText('ledger-total-expense',money(expense));
                setText('ledger-total-transfer',money(transfers));
                setText('ledger-total-net',money(income-expense));
                // Selection only ever covers rows currently on screen, so bulk actions never touch hidden or excluded entries by accident.
                const visibleIds=new Set(filtered.map(t=>String(t.id)));
                this.selectedTransactionIds=new Set([...(this.selectedTransactionIds||[])].filter(id=>visibleIds.has(id)));
                const jsId=id=>this.escapeHtml(String(id??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"));

                tbody.innerHTML = this.ledgerRowsWithDayHeaders(filtered, t => `
                    <tr class="${t.excludedFromLedger?'opacity-60 bg-amber-50/50 dark:bg-amber-950/10':''} cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500" title="Click to open transaction" tabindex="0" role="button" onclick="if(!event.target.closest('button,input,label,a,select')) app.editTransaction('${jsId(t.id)}')" onkeydown="if((event.key==='Enter'||event.key===' ') && !event.target.closest('button,input,label,a,select')){event.preventDefault();app.editTransaction('${jsId(t.id)}')}">
                        <td class="py-3"><input type="checkbox" class="ledger-row-select" value="${this.escapeHtml(String(t.id))}" ${this.selectedTransactionIds?.has(String(t.id))?'checked':''} onchange="app.toggleTransactionSelection('${jsId(t.id)}',this.checked)" aria-label="Select transaction" onclick="event.stopPropagation()"></td>
                        <td class="py-3 text-slate-500">${this.escapeHtml(t.date||'')}</td>
                        <td class="py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'Income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}">${this.escapeHtml(t.type||'')}</span></td>
                        <td class="py-3 font-medium">${this.escapeHtml(t.payee||t.description||'')}${t.excludedFromLedger?` <span title="${this.escapeHtml(t.duplicateReason||'Excluded from totals')}" class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">${t.duplicateOf?'Duplicate':'Excluded'}</span>`:''}${this.cardBadge(t)}${this.reconBadge(t)}<div class="text-xs text-slate-400 font-normal">${this.escapeHtml(t.notes||t.note||'')}</div></td>
                        <td class="py-3"><span class="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800">${this.escapeHtml(t.category||'Uncategorized')}</span>${t.subcategory?`<div class="text-xs text-slate-400 mt-1">${this.escapeHtml(t.subcategory)}</div>`:''}</td>
                        <td class="py-3 text-slate-500">${this.escapeHtml(t.account||'')}</td>
                        <td class="py-3 text-right font-semibold ${t.type === 'Income' ? 'text-emerald-600' : ''}">₹${Number(t.amount).toLocaleString('en-IN')}</td>
                        <td class="py-3 text-center">
                            <button onclick="event.stopPropagation();app.editTransaction('${jsId(t.id)}')" class="p-1 hover:text-emerald-600 row-act" title="Edit transaction" aria-label="Edit transaction"><i data-lucide="pencil" class="w-4 h-4"></i><span class="row-act-label">Edit</span></button> <button onclick="event.stopPropagation();app.toggleLedgerExclusion('${jsId(t.id)}')" class="p-1 row-act ${t.excludedFromLedger?'text-emerald-600 hover:text-emerald-700':'text-amber-600 hover:text-amber-700'}" title="${t.excludedFromLedger?'Restore to ledger':'Exclude from ledger'}" aria-label="${t.excludedFromLedger?'Restore to ledger':'Exclude from ledger'}"><i data-lucide="${t.excludedFromLedger?'rotate-ccw':'archive'}" class="w-4 h-4"></i><span class="row-act-label">${t.excludedFromLedger?'Restore':'Exclude'}</span></button> <button onclick="event.stopPropagation();app.deleteTransaction('${jsId(t.id)}')" class="p-1 hover:text-rose-600 row-act row-act-danger" title="Delete permanently" aria-label="Delete transaction"><i data-lucide="trash-2" class="w-4 h-4"></i><span class="row-act-label">Delete</span></button>
                        </td>
                    </tr>
                `);
                // Empty filtered view: say so instead of leaving a blank list.
                if(!filtered.length){ const mode=document.getElementById('ledger-excluded-filter')?.value||'active'; const msg={excluded:'No excluded transactions. Entries you exclude appear here so you can restore them.',duplicates:'No SMS duplicates found.'}[mode]||'No transactions match the current filters.'; tbody.innerHTML=`<tr><td colspan="8" class="py-8 text-center text-sm text-slate-500">${msg}</td></tr>`; }
                const bulkBar=document.getElementById('ledger-bulk-bar'); if(bulkBar)bulkBar.hidden=!filtered.length;
                const selectAll=document.getElementById('ledger-select-all');
                if(selectAll){selectAll.checked=filtered.length>0 && filtered.every(t=>this.selectedTransactionIds?.has(String(t.id)));selectAll.indeterminate=filtered.some(t=>this.selectedTransactionIds?.has(String(t.id)))&&!selectAll.checked;}
                const count=document.getElementById('ledger-selected-count');
                if(count)count.textContent=`${this.selectedTransactionIds?.size||0} selected`; this.syncLedgerBulkBar();
                window.lucide?.createIcons?.();
            }

            /**
             * Changes the ledger exclusion and refreshes dependent UI.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async toggleLedgerExclusion(id){
                const tx=this.data.tx.find(t=>String(t.id)===String(id)); if(!tx)return;
                const excluding=!tx.excludedFromLedger;
                const label=tx.payee||tx.description||tx.notes||'this transaction';
                const restoreNotes=[];
                if(tx.duplicateOf)restoreNotes.push(`It was marked as an SMS duplicate (${tx.duplicateReason||'matched another transaction'}). Restoring keeps it counted from now on.`);
                restoreNotes.push(tx.balanceEffectRemoved?`Its amount will be re-applied to the ${tx.account||'account'} balance.`:'Account balances are not changed.');
                // Restoring an SMS duplicate changes balances and clears its duplicate link, so it cannot be undone cleanly: confirm first.
                // A plain exclude/restore only flips a flag, so it applies at once with an Undo toast.
                if(!excluding&&(tx.duplicateOf||tx.balanceEffectRemoved)){
                    if(!await this.uiConfirm(`Restore "${label}" to the active Core Ledger?\n\nIt will count toward dashboard totals, charts and budgets again.\n\n${restoreNotes.join('\n')}`))return;
                    this.setLedgerExclusion(tx,false); this.saveVault(); this.renderAll();
                    return this.showToast(`Restored "${label}".`);
                }
                this.setLedgerExclusion(tx,excluding); this.saveVault(); this.renderAll();
                this.showToast(excluding?`Excluded "${label}" from totals. Find it under Excluded transactions.`:`Restored "${label}" to the ledger.`,{undo:()=>{ this.setLedgerExclusion(tx,!excluding); this.saveVault(); this.renderAll(); }});
            }
            /**
             * Shows a short message at the bottom of the screen, optionally with an Undo button. Replaces any toast already showing.
             * Parameters: msg, {undo, ms}.
             */
            showToast(msg,{undo,ms=6000}={}){
                document.getElementById('app-toast')?.remove(); clearTimeout(this._toastTimer);
                const el=document.createElement('div'); el.id='app-toast'; el.setAttribute('role','status');
                el.innerHTML=`<span></span>${undo?'<button type="button">Undo</button>':''}`; el.firstChild.textContent=msg;
                if(undo)el.querySelector('button').onclick=()=>{ el.remove(); clearTimeout(this._toastTimer); undo(); };
                document.body.appendChild(el); this._toastTimer=setTimeout(()=>el.remove(),ms);
            }

            /**
             * Changes the transaction selection and refreshes dependent UI.
             * Parameters: id,checked. Side effects, if any, are described by the statements below.
             */
            toggleTransactionSelection(id,checked){this.selectedTransactionIds ||= new Set();checked?this.selectedTransactionIds.add(String(id)):this.selectedTransactionIds.delete(String(id));const c=document.getElementById('ledger-selected-count');if(c)c.textContent=`${this.selectedTransactionIds.size} selected`;this.syncLedgerBulkBar();}
            /**
             * Changes the select all and refreshes dependent UI.
             * Parameters: checked. Side effects, if any, are described by the statements below.
             */
            toggleSelectAll(checked){this.selectedTransactionIds ||= new Set();this.getFilteredLedger().forEach(t=>{if(checked)this.selectedTransactionIds.add(String(t.id));else this.selectedTransactionIds.delete(String(t.id));});this.renderLedger();}
            /**
             * Handles the clear transaction selection workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            clearTransactionSelection(){this.selectedTransactionIds=new Set();this.renderLedger();}
            /**
             * Handles the bulk delete transactions workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async bulkDeleteTransactions(){const ids=this.selectedTransactionIds?Array.from(this.selectedTransactionIds):[];if(!ids.length)return alert('Select at least one transaction first.');if(!await this.uiConfirm(`Delete ${ids.length} selected transaction(s)? This cannot be undone. Please ensure you have a backup.`))return;const chosen=this.data.tx.filter(t=>ids.includes(String(t.id)));chosen.forEach(t=>this.applyTxEffects(t,-1));this.data.tx=this.data.tx.filter(t=>!ids.includes(String(t.id)));await this.releaseDuplicatesOf(ids);this.selectedTransactionIds=new Set();this.saveVault();this.renderAll();alert(`${chosen.length} transaction(s) deleted.`);}
            /**
             * Opens the  bulk edit modal screen, dialog, or workflow.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            openBulkEditModal(){
                const ids=this.selectedTransactionIds?Array.from(this.selectedTransactionIds):[];
                if(!ids.length)return alert('Select one or more transactions first.');
                const box=document.getElementById('modal-box');
                const opts=(arr,current='')=>['<option value="">— Leave unchanged —</option>',...arr.map(v=>`<option value="${this.escapeHtml(v)}">${this.escapeHtml(v)}</option>`)].join('');
                box.innerHTML=`<div class="flex justify-between items-center border-b pb-3"><h3 class="font-bold">Bulk edit ${ids.length} transaction(s)</h3><button onclick="app.closeModal()">✕</button></div>
                <p class="text-sm text-slate-500">Only fields you change will be applied to every selected transaction. Leave a field unchanged to preserve its current value.</p>
                <form onsubmit="app.applyBulkEdit(event)" class="space-y-3">
                <label class="block text-xs font-semibold">Date<input id="bulk-date" type="date" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label>
                <label class="block text-xs font-semibold">Type<select id="bulk-edit-type" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800">${opts(['Expense','Income','Transfer','EMI','Installment'])}</select></label>
                <label class="block text-xs font-semibold">Amount<input id="bulk-amount" type="number" min="0" step="0.01" placeholder="Leave unchanged" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><button type="button" onclick="app.openAmountCalculator('bulk-amount')" class="mt-1 text-xs text-emerald-600 hover:underline">🧮 Calculator</button></label>
                <label class="block text-xs font-semibold">Payee / Name<input id="bulk-payee" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800" placeholder="Leave unchanged"></label>
                <label class="block text-xs font-semibold">Category<select id="bulk-category" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800">${opts([...new Set([...(this.data.categories||[]),...this.data.tx.map(t=>t.category).filter(Boolean)])])}</select></label>
                <label class="block text-xs font-semibold">Subcategory<input id="bulk-subcategory" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800" placeholder="Leave unchanged"></label>
                <label class="block text-xs font-semibold">Account<select id="bulk-account" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800">${opts(this.data.accounts.map(a=>a.name))}</select></label>
                <label class="block text-xs font-semibold">Note<input id="bulk-note" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800" placeholder="Leave unchanged"></label>
                <label class="block text-xs font-semibold">Description / Narration<textarea id="bulk-description" rows="3" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800" placeholder="Leave unchanged"></textarea></label>
                <div class="flex justify-end gap-2 pt-3"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-lg">Apply to selected</button></div></form>`;
                document.getElementById('modal-container').classList.remove('hidden');
            }
            /**
             * Handles the apply bulk edit workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: event. Side effects, if any, are described by the statements below.
             */
            async applyBulkEdit(event){
                event.preventDefault();
                const ids=this.selectedTransactionIds?Array.from(this.selectedTransactionIds):[];
                if(!ids.length)return alert('No transactions selected.');
                const val=id=>document.getElementById(id)?.value??'';
                const changes={date:val('bulk-date'),type:val('bulk-edit-type'),amount:val('bulk-amount'),payee:val('bulk-payee'),category:val('bulk-category'),subcategory:val('bulk-subcategory'),account:val('bulk-account'),notes:val('bulk-note'),description:val('bulk-description')};
                if(changes.amount!==''&&(!Number.isFinite(Number(changes.amount))||Number(changes.amount)<0))return alert('Enter a valid non-negative amount.');
                if(!Object.values(changes).some(v=>v!==''))return alert('Make at least one change before applying.');
                if(!await this.uiConfirm(`Apply the selected field changes to ${ids.length} transaction(s)? Account balances will not be automatically recalculated; reconcile them after editing.`))return;
                let count=0;
                this.data.tx.forEach(t=>{if(!ids.includes(String(t.id)))return;for(const [k,v] of Object.entries(changes)){if(v==='')continue;if(k==='amount')t[k]=Number(v);else if(k==='subcategory')t.subcategory=v;else if(k==='note')t.note=v;else t[k]=v;}this.ensureCategoryAndSubcategory(t.category,t.subcategory);count++;});
                this.saveVault();this.renderAll();this.renderLedger();this.closeModal();alert(`Updated ${count} transaction(s). Please review account balances.`);
            }
            /**
             * Handles the bulk change type from menu workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: el. Side effects, if any, are described by the statements below.
             */
            bulkChangeTypeFromMenu(el){ if(!el||!el.value)return; Promise.resolve(this.bulkChangeType()).finally(()=>{el.value='';}); }
            /**
             * Handles the sync ledger bulk bar workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            syncLedgerBulkBar(){ const n=this.selectedTransactionIds?.size||0; const bar=document.getElementById('ledger-bulk-bar'); if(bar)bar.dataset.hasSelection=n?'1':'0'; const c=document.getElementById('ledger-bulk-count'); if(c)c.textContent=`${n} selected`; }
            /**
             * Handles the bulk change type workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async bulkChangeType(){const ids=this.selectedTransactionIds?Array.from(this.selectedTransactionIds):[];const type=document.getElementById('bulk-type')?.value;if(!ids.length)return alert('Select at least one transaction first.');if(!type)return alert('Choose the new transaction type.');if(!await this.uiConfirm(`Change ${ids.length} selected transaction(s) to ${type}? Account balances are not automatically recalculated for bulk type changes. Review account balances afterwards.`))return;this.data.tx.forEach(t=>{if(ids.includes(String(t.id)))t.type=type;});this.saveVault();this.renderAll();this.renderLedger();alert(`${ids.length} transaction(s) updated to ${type}.`);}

            /**
             * Handles the normalize ledger date workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: value. Side effects, if any, are described by the statements below.
             */
            normalizeLedgerDate(value){
                if(value===null||value===undefined||value==='')return '';
                if(value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
                const s=String(value).trim();
                let m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
                if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
                m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
                if(m){
                    // Spreadsheet dates in this app use DD/MM/YYYY (or DD-MM-YYYY).
                    const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
                    if(day>=1&&day<=31&&month>=1&&month<=12)return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                }
                return '';
            }
            /**
             * Handles the populate ledger years workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            populateLedgerYears(){
                const sel=document.getElementById('ledger-filter-year');if(!sel)return;
                const old=sel.value;
                const years=[...new Set(this.data.tx.map(t=>this.normalizeLedgerDate(t.date).slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort().reverse();
                sel.innerHTML='<option value="">All years</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join('');
                if(years.includes(old))sel.value=old;
            }
            /**
             * Updates ledger sort.
             * Parameters: field. Side effects, if any, are described by the statements below.
             */
            setLedgerSort(field) { const el=document.getElementById('ledger-sort-date'); if(!el)return; const current=el.value||'desc'; const map={date:['desc','asc'],payee:['payee-asc','payee-desc'],type:['type-asc','type-desc'],category:['category-asc','category-desc'],account:['account-asc','account-desc'],amount:['amount-asc','amount-desc']}; const pair=map[field]||map.date; el.value=current===pair[0]?pair[1]:pair[0]; this.renderLedger(); }
            /**
             * Handles the filter ledger workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            filterLedger() { this.renderLedger(); }

            /**
             * Updates transaction.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            editTransaction(id) {
                const t=this.data.tx.find(x=>String(x.id)===String(id)); if(!t)return;
                const box=document.getElementById('modal-box');
                const esc=v=>this.escapeHtml(String(v??''));
                const categories=[...new Set([...(this.data.categories||[]),t.category||'Uncategorized'])];
                box.innerHTML=`<div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3"><h3 class="font-bold text-base">Edit Transaction</h3><button type="button" onclick="app.closeModal()" class="text-slate-400">✕</button></div>
                <form onsubmit="app.saveEditedTransaction(event,'${String(t.id).replace(/'/g,"\\'")}')" class="space-y-4 pt-2">
                <div class="grid grid-cols-2 gap-3"><div><label class="text-xs font-semibold text-slate-500">Transaction Date</label><input id="edit-tx-date" type="date" required value="${esc(this.normalizeLedgerDate(t.date)||'')}" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800">${t.source==='sms'||t.originalSmsDate?`<p class="text-xs text-slate-500 mt-1">Original SMS date: ${esc(t.originalSmsDate||t.date||'Not recorded')} (preserved separately)</p>`:''}</div><div><label class="text-xs font-semibold text-slate-500">Type</label><select id="edit-tx-type" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800">${['Expense','Income','Transfer','EMI','Installment'].map(x=>`<option ${t.type===x?'selected':''}>${x}</option>`).join('')}</select></div></div>
                <div><label class="text-xs font-semibold text-slate-500">Amount (₹)</label><input id="edit-tx-amount" type="number" min="0.01" step="0.01" required value="${esc(t.amount)}" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800"><button type="button" onclick="app.openAmountCalculator('edit-tx-amount')" class="mt-1 text-xs text-emerald-600 hover:underline">🧮 Calculator</button></div>
                <div><label class="text-xs font-semibold text-slate-500">Payee</label><input id="edit-tx-payee" required value="${esc(t.payee)}" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></div>
                <div class="grid grid-cols-2 gap-3"><div><label class="text-xs font-semibold text-slate-500">Category</label><input id="edit-tx-category" list="edit-category-options" value="${esc(t.category||'Uncategorized')}" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800"><datalist id="edit-category-options">${categories.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div><div><label class="text-xs font-semibold text-slate-500">Subcategory</label><input id="edit-tx-subcategory" value="${esc(t.subcategory||'')}" placeholder="e.g. HouseRent, Computer" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></div></div>
                <div><label class="text-xs font-semibold text-slate-500">Account</label><select id="edit-tx-account" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800">${this.data.accounts.map(a=>`<option value="${esc(a.name)}" ${t.account===a.name?'selected':''}>${esc(a.name)}</option>`).join('')}</select></div>
                <div><label class="text-xs font-semibold text-slate-500">Note</label><textarea id="edit-tx-note" rows="2" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800">${esc(t.note??t.notes??'')}</textarea></div>
                <div><label class="text-xs font-semibold text-slate-500">Description</label><textarea id="edit-tx-description" rows="4" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800">${esc(t.description??'')}</textarea></div>
                <div class="flex justify-end gap-3 border-t pt-4"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-xl">Cancel</button><button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-xl">Save Changes</button></div></form>`;
                document.getElementById('modal-container').classList.remove('hidden');
            }

            /**
             * Validates and saves  edited transaction.
             * Parameters: event,id. Side effects, if any, are described by the statements below.
             */
            saveEditedTransaction(event,id) {
                event.preventDefault(); const t=this.data.tx.find(x=>String(x.id)===String(id)); if(!t)return; const beforeEdit={...t}; if(this.isLockedDate(t.date))return this.lockedAlert(t.date);
                const oldAmount=Number(t.amount)||0, oldType=t.type, oldAccount=t.account;
                const amount=Number(document.getElementById('edit-tx-amount').value); if(!Number.isFinite(amount)||amount<=0)return alert('Enter an amount greater than zero.');
                const oldAcc=this.data.accounts.find(a=>a.name===oldAccount);
                this.applyTxEffects(beforeEdit,-1);
                const enteredDate=document.getElementById('edit-tx-date').value; const normalizedDate=this.normalizeLedgerDate(enteredDate); if(enteredDate && !normalizedDate)return alert('Please enter a valid date in YYYY-MM-DD format.'); const previousTransactionDate=t.date; const preservedOriginalSmsDate=t.originalSmsDate; t.date=normalizedDate || this.normalizeLedgerDate(previousTransactionDate) || previousTransactionDate; if(preservedOriginalSmsDate!==undefined)t.originalSmsDate=preservedOriginalSmsDate; t.type=document.getElementById('edit-tx-type').value; t.amount=amount;
                t.payee=document.getElementById('edit-tx-payee').value.trim(); t.category=document.getElementById('edit-tx-category').value.trim()||'Uncategorized';
                t.subcategory=document.getElementById('edit-tx-subcategory').value.trim(); t.note=document.getElementById('edit-tx-note').value; t.notes=t.note; t.description=document.getElementById('edit-tx-description').value; t.account=document.getElementById('edit-tx-account').value;
                this.applyTxEffects(t,1);
                if(!this.data.categories.some(c=>String(c).toLowerCase()===t.category.toLowerCase()))this.data.categories.push(t.category);
                const flagged=this.autoFlagSmsDuplicates();
                this.saveVault();this.renderAll();this.closeModal();
                if(flagged)alert(this.smsDuplicateNotice(flagged));
            }

            /**
             * Handles the ledger spreadsheet headers workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            ledgerSpreadsheetHeaders() { return ['Date','Account','Category','Subcategory','Note','INR','Income/Expense','Description','Amount','Currency','Account','UUID']; }
            /**
             * Handles the ledger spreadsheet rows workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            ledgerSpreadsheetRows() {
                return this.countedTx().map(t => [
                    this.formatLedgerDate(t.date), t.account || '', t.category || '', t.subcategory || '',
                    t.notes || t.note || '', t.inrValue ?? t.amount ?? '',
                    t.type || 'Expense', t.description || t.notes || '', t.amount ?? '', t.currency || 'INR',
                    t.accountLedgerValue ?? '', t.uid || ''
                ]);
            }
            /**
             * Builds the transaction-entry form and its initial field values.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            openTransactionModal() {
                const box = document.getElementById('modal-box');
                box.innerHTML = `
                    <div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                        <h3 class="font-bold text-base">New Transaction</h3>
                        <button onclick="app.closeModal()" class="text-slate-400 hover:text-slate-600"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    <form onsubmit="app.saveNewTransaction(event)" class="space-y-4 pt-2">
                        <div class="space-y-1">
                            <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Type</label>
                            <select id="modal-tx-type" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                                <option value="Expense">Expense</option>
                                <option value="Income">Income</option>
                                <option value="Transfer">Transfer</option>\n                                <option value="EMI">EMI</option>\n                                <option value="Installment">Installment</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount (₹)</label>
                            <input type="number" step="0.01" id="modal-tx-amount" required placeholder="0" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"><button type="button" onclick="app.openAmountCalculator('modal-tx-amount')" class="mt-1 text-xs text-emerald-600 hover:underline">🧮 Calculator</button>
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Payee / Description</label>
                            <input type="text" id="modal-tx-payee" required placeholder="Merchant or source name" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Category</label>
                                <select id="modal-tx-category" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                                    ${this.data.categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                                </select>
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Account</label>
                                <select id="modal-tx-account" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                                    ${this.data.accounts.map(a => `<option value="${this.escapeHtml(a.name)}" ${this.getGlobalDefaultAccount() && String(this.getGlobalDefaultAccount().name)===String(a.name)?'selected':''}>${this.escapeHtml(a.name)}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div id="modal-tx-destination-wrap" class="space-y-1 hidden">
                            <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Destination account (for savings / FD / RD / investment transfer)</label>
                            <select id="modal-tx-destination" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                                ${this.data.accounts.map(a => `<option value="${a.name}">${a.name} (${a.type})</option>`).join('')}
                            </select>
                            <p class="text-xs text-slate-500">A transfer into an asset account is counted as monthly allocation/expense and increases that account's asset balance.</p>
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</label>
                            <input type="date" id="modal-tx-date" value="${new Date().toISOString().split('T')[0]}" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                        </div>
                        <div class="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <button type="button" onclick="app.closeModal()" class="px-4 py-2 border border-slate-300 dark:border-slate-700 text-sm font-medium rounded-xl">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm">Save Transaction</button>
                        </div>
                    </form>
                `;
                document.getElementById('modal-container').classList.remove('hidden');
                const defaultAccount=this.getGlobalDefaultAccount();
                const accountSelect=document.getElementById('modal-tx-account');
                if(defaultAccount&&accountSelect)accountSelect.value=defaultAccount.name;
                
                const typeSelect=document.getElementById('modal-tx-type');
                const destinationWrap=document.getElementById('modal-tx-destination-wrap');
                const sourceSelect=document.getElementById('modal-tx-account');
                const destinationSelect=document.getElementById('modal-tx-destination');
                const updateTransferUI=()=>{destinationWrap.classList.toggle('hidden',typeSelect.value!=='Transfer');if(typeSelect.value==='Transfer'&&destinationSelect.value===sourceSelect.value){const other=[...destinationSelect.options].find(o=>o.value!==sourceSelect.value);if(other)destinationSelect.value=other.value;}};
                typeSelect.addEventListener('change',updateTransferUI);
                sourceSelect.addEventListener('change',updateTransferUI);
                destinationSelect.addEventListener('change',updateTransferUI);
                updateTransferUI();
                window.lucide?.createIcons?.();
            }

            /**
             * Validates and saves a new ledger transaction, including related balance effects.
             * Parameters: event. Side effects, if any, are described by the statements below.
             */
            saveNewTransaction(event) {
                event.preventDefault();
                const type = document.getElementById('modal-tx-type').value;
                const amount = parseFloat(document.getElementById('modal-tx-amount').value);
                const payee = document.getElementById('modal-tx-payee').value;
                const category = document.getElementById('modal-tx-category').value;
                const account = document.getElementById('modal-tx-account').value || this.getGlobalDefaultAccount()?.name || '';
                const date = document.getElementById('modal-tx-date').value;
                if (!Number.isFinite(amount) || amount <= 0) return alert('Enter an amount greater than zero.');
                if (!account || !date) return alert('Select an account and date.');

                const destinationAccount = type === 'Transfer' ? (document.getElementById('modal-tx-destination')?.value || '') : '';
                if (type === 'Transfer' && (!destinationAccount || destinationAccount === account)) return alert('Choose a destination account that is different from the source account.');
                if (this.isLockedDate(date)) return this.lockedAlert(date);
                const newTx = { id: 'tx_' + Date.now(), uid: this.newUid(), date, type, amount, account, category, payee, notes: '', ...(destinationAccount ? { destinationAccount } : {}) };
                this.data.tx.unshift(newTx);
                this.applyTxEffects(newTx, 1);

                const flagged = this.autoFlagSmsDuplicates();
                this.saveVault();
                this.renderAll();
                this.closeModal();
                if (flagged) alert(this.smsDuplicateNotice(flagged));
            }

            /**
             * Confirms deletion and reverses the transaction’s account effects where applicable.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async deleteTransaction(id) {
                const tx=this.data.tx.find(t=>String(t.id)===String(id)); if(!tx)return; if(this.isLockedDate(tx.date))return this.lockedAlert(tx.date);
                if (await this.uiConfirm('Delete this transaction? The account balance will be adjusted where possible.')) {
                    this.applyTxEffects(tx,-1);
                    this.data.tx=this.data.tx.filter(t=>String(t.id)!==String(id));
                    await this.releaseDuplicatesOf([id]);
                    this.saveVault(); this.renderAll();
                }
            }

        }
