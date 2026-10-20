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
            ledgerHeaderPrefs(){ const d={pin:true,filters:'auto',count:true,totals:['income','expense','net']}; try{ return {...d,...JSON.parse(localStorage.getItem('aifico_ledger_header')||'{}')}; }catch(e){ return d; } }
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
                // Day (from the Calendar) and category (from Stats): shown as chips even while the filter panel is open.
                if(this.ledgerDay&&this.ledgerViewName()==='daily')out.push({id:'__day',label:new Date(this.ledgerDay+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'}),reset:'',always:true});
                if(this.ledgerCategory)out.push({id:'__cat',label:this.ledgerCategory,reset:'',always:true});
                return out;
            }
            /**
             * Handles the clear ledger filter workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: id,reset){ const el=document.getElementById(id); if(el. Side effects, if any, are described by the statements below.
             */
            clearLedgerFilter(id,reset){ if(id==='__day')this.ledgerDay=''; else if(id==='__cat')this.ledgerCategory=''; else { const el=document.getElementById(id); if(el){ el.value=reset||''; } } this.filterLedger(); }
            /**
             * Changes the ledger filters and refreshes dependent UI.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            toggleLedgerFilters(){ this.ledgerFiltersOpen=!this.ledgerFiltersIsOpen(); this.applyLedgerHeader(); }
            toggleLedgerSearch(){ const box=document.getElementById('ledger-search'); const open=!(this.ledgerSearchOpen||box?.value); this.ledgerSearchOpen=open; if(!open&&box&&box.value){ box.value=''; this.filterLedger(); } this.applyLedgerHeader(); if(open)setTimeout(()=>box?.focus(),0); }
            /**
             * Handles the ledger filters is open workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            ledgerFiltersIsOpen(){ const p=this.ledgerHeaderPrefs(); if(p.filters==='always')return true; if(p.filters==='button')return !!this.ledgerFiltersOpen; const wide=(document.getElementById('panel-ledger')?.clientWidth||0)>760&&window.innerHeight>=600; return this.ledgerFiltersOpen===undefined?wide:!!this.ledgerFiltersOpen; }
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
                const chips=document.getElementById('ledger-chips'); const chipList=open?act.filter(a=>a.always):act; if(chips){ chips.innerHTML=chipList.map(a=>`<button type="button" class="lh-chip" onclick="app.clearLedgerFilter('${a.id}','${a.reset}')" aria-label="Remove filter ${this.escapeHtml(a.label)}">${this.escapeHtml(a.label)} <span aria-hidden="true">✕</span></button>`).join(''); chips.hidden=!chipList.length; }
                const cnt=document.getElementById('ledger-total-count'); if(cnt)cnt.hidden=!p.count;
                const map={income:'ledger-total-income',expense:'ledger-total-expense',transfer:'ledger-total-transfer',net:'ledger-total-net'}; let shown=0;
                Object.entries(map).forEach(([k,id])=>{ const cell=document.getElementById(id)?.parentElement; if(cell){ const on=p.totals.includes(k); cell.hidden=!on; if(on)shown++; } });
                const tot=document.getElementById('ledger-totals'); if(tot){ tot.hidden=!shown; tot.style.setProperty('--lh-cols',Math.max(1,shown)); tot.style.setProperty('--lh-cols-sm',shown<=3?Math.max(1,shown):2); }
                // Phones: search sits behind the magnifier button until opened (or while it has text). Wide screens always show it.
                const sv=document.getElementById('ledger-search')?.value||''; const sr=document.getElementById('ledger-search-row'); if(sr)sr.hidden=!(this.ledgerSearchOpen||sv);
                const st=document.getElementById('ledger-search-toggle'); if(st){ const on=!!(this.ledgerSearchOpen||sv); st.classList.toggle('on',on); st.setAttribute('aria-expanded',String(on)); }
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
                const money=v=>(CUR())+(Number(v)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
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
            // ---------- Month switcher and views: Daily · Calendar · Monthly · Total ----------
            /** Today's date as YYYY-MM-DD in the phone's own time zone (toISOString() gives yesterday before 5:30 am in India). */
            todayISO(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
            fmtMoney(v){ const n=Number(v)||0; return (n<0?'-':'')+CUR()+Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
            fmtMoney0(v){ const n=Math.round(Number(v)||0); return (n<0?'-':'')+CUR()+Math.abs(n).toLocaleString('en-IN'); }
            /** Short amounts for calendar cells: 950, 12.5K, 1.2L, 3.4Cr. */
            compactMoney(v){ const n=Math.abs(Number(v)||0); try{ return new Intl.NumberFormat('en-IN',{notation:'compact',maximumFractionDigits:1}).format(n).replace(/T$/,'K'); }catch(e){ return Math.round(n).toLocaleString('en-IN'); } }
            ledgerViewName(){ let v=this.ledgerView; if(!v){ try{ v=localStorage.getItem('aifico_ledger_view'); }catch(e){} } return ['daily','calendar','monthly','total'].includes(v)?v:'daily'; }
            /** The month the ledger shows: 'YYYY-MM', or 'all' for every date. Starts at the current month. */
            ledgerMonth(){ return this.ledgerPeriod||this.todayISO().slice(0,7); }
            monthLabel(key,long){ const m=String(key||'').match(/^(\d{4})-(\d{2})$/); if(!m)return 'All time'; return new Date(+m[1],+m[2]-1,1).toLocaleDateString('en-IN',{month:long?'long':'short',year:'numeric'}); }
            setLedgerView(v){
                this.ledgerView=v; try{ localStorage.setItem('aifico_ledger_view',v); }catch(e){}
                const month=this.ledgerMonth();
                if(v==='monthly')this.ledgerYearView=month==='all'?new Date().getFullYear():Number(month.slice(0,4));
                if(v==='calendar'&&month==='all')this.ledgerPeriod=this.todayISO().slice(0,7);
                if(v!=='daily')this.ledgerDay='';
                this.ledgerShown=0; this.renderLedger(); document.getElementById('app-scroll')?.scrollTo?.(0,0);
            }
            /** Shows one month ('YYYY-MM') or 'all'. Choosing a month clears the year and date-range filters, which would fight it. */
            setLedgerPeriod(p){
                this.ledgerPeriod=p; this.ledgerDay='';
                if(p!=='all')['ledger-filter-year','ledger-date-from','ledger-date-to'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
                this.ledgerShown=0; this.renderLedger();
            }
            /** ‹ › buttons: one month back or forward (one year in the Monthly view). */
            shiftLedgerPeriod(step){
                if(this.ledgerViewName()==='monthly'){ this.ledgerYearView=(this.ledgerYearView||new Date().getFullYear())+step; return this.renderLedger(); }
                let key=this.ledgerMonth(); if(key==='all')key=this.todayISO().slice(0,7);
                const [y,m]=key.split('-').map(Number); const d=new Date(y,m-1+step,1);
                this.setLedgerPeriod(this.todayISO(d).slice(0,7));
            }
            /** Year, From or To filters set: show every month so the range is not cut down to one month. */
            ledgerDateFilterChanged(){ if(['ledger-filter-year','ledger-date-from','ledger-date-to'].some(id=>document.getElementById(id)?.value)){ this.ledgerPeriod='all'; this.ledgerDay=''; } this.filterLedger(); }
            /** Calendar → tap a day: that day's entries in the Daily list. */
            openLedgerDay(iso){ this.ledgerPeriod=iso.slice(0,7); this.ledgerDay=iso; this.ledgerView='daily'; try{ localStorage.setItem('aifico_ledger_view','daily'); }catch(e){} this.ledgerShown=0; this.renderLedger(); }
            /** Monthly or Total → tap a month or year. */
            openLedgerMonth(key){ this.ledgerPeriod=key; this.ledgerDay=''; this.setLedgerView('daily'); }
            openLedgerYear(y){ this.ledgerYearView=Number(y); this.ledgerView='monthly'; try{ localStorage.setItem('aifico_ledger_view','monthly'); }catch(e){} this.renderLedger(); }
            /** Stats → tap a category: the ledger for that category and period. */
            openLedgerCategory(cat,period){ this.ledgerCategory=cat; this.ledgerDay=''; const yearOnly=/^\d{4}$/.test(String(period||'')); this.ledgerPeriod=yearOnly?'all':(period||'all');
                ['ledger-filter-year','ledger-date-from','ledger-date-to'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
                if(yearOnly){ this.populateLedgerYears(); const y=document.getElementById('ledger-filter-year'); if(y)y.value=period; } this.ledgerView='daily'; try{ localStorage.setItem('aifico_ledger_view','daily'); }catch(e){} this.ledgerShown=0; this.switchTab('ledger'); this.renderLedger(); }
            /** Tapping the month name: pick any month, this month, or all time. */
            openLedgerPeriodPicker(){
                const box=document.getElementById('modal-box'); const cur=this.ledgerMonth();
                box.innerHTML=`<div class="more-head"><h3 class="font-bold text-lg">Show period</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                <div class="space-y-3"><label class="ip-field"><span>Month</span><input id="lp-month" type="month" value="${cur==='all'?this.todayISO().slice(0,7):cur}"></label>
                <div class="lp-quick"><button type="button" class="s-btn s-secondary" onclick="app.closeModal();app.setLedgerPeriod('${this.todayISO().slice(0,7)}')">This month</button><button type="button" class="s-btn s-secondary" onclick="app.closeModal();app.setLedgerView('daily');app.setLedgerPeriod('all')">All time</button><button type="button" class="s-btn s-primary" onclick="const v=document.getElementById('lp-month').value;app.closeModal();if(v)app.setLedgerPeriod(v)">Show month</button></div></div>`;
                document.getElementById('modal-container').classList.add('more-sheet'); document.getElementById('modal-container').classList.remove('hidden');
            }
            /** Period bar and view tabs above the list. */
            renderLedgerPeriodBar(view){
                const label=document.getElementById('ledger-period-label'); if(!label)return;
                const month=this.ledgerMonth();
                label.textContent=view==='total'?'All time':view==='monthly'?String(this.ledgerYearView||new Date().getFullYear()):this.monthLabel(month);
                document.querySelectorAll('#ledger-period .lp-nav').forEach(b=>{ b.hidden=view==='total'||(view==='daily'&&month==='all'); });
                document.querySelectorAll('#ledger-views [data-view]').forEach(b=>{ const on=b.dataset.view===view; b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on)); });
            }
            /** Calendar view: a month grid with each day's income and spending. */
            ledgerCalendarHtml(list,month){
                const [y,m]=month.split('-').map(Number); const first=new Date(y,m-1,1).getDay(); const days=new Date(y,m,0).getDate(); const today=this.todayISO();
                const per=new Map(); list.forEach(t=>{ const k=this.normalizeLedgerDate(t.date); const o=per.get(k)||{inc:0,exp:0,n:0}; const a=Number(t.amount)||0; if(t.type==='Income')o.inc+=a; else if(['Expense','EMI','Installment'].includes(t.type))o.exp+=a; o.n++; per.set(k,o); });
                let cells=''; for(let i=0;i<first;i++)cells+='<span class="lcal-cell lcal-pad"></span>';
                for(let d=1;d<=days;d++){ const k=`${month}-${String(d).padStart(2,'0')}`; const o=per.get(k); const dow=(first+d-1)%7;
                    cells+=`<button type="button" class="lcal-cell${k===today?' lcal-today':''}${dow===0?' lcal-sun':dow===6?' lcal-sat':''}${o?' lcal-has':''}" onclick="app.openLedgerDay('${k}')" aria-label="${d} ${this.monthLabel(month,true)}${o?`: ${o.n} entr${o.n===1?'y':'ies'}`:''}"><span class="lcal-d">${d}</span>${o&&o.inc?`<span class="lcal-in">${this.compactMoney(o.inc)}</span>`:''}${o&&o.exp?`<span class="lcal-out">${this.compactMoney(o.exp)}</span>`:''}</button>`; }
                const dows=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>`<span class="${i===0?'lcal-sun':i===6?'lcal-sat':''}">${d}</span>`).join('');
                return `<div class="lcal"><div class="lcal-dow">${dows}</div><div class="lcal-grid">${cells}</div></div>`;
            }
            /** Monthly view: each month of the year with income, spending and the difference. */
            ledgerMonthlyHtml(list,year){
                const sums=Array.from({length:12},()=>({inc:0,exp:0,n:0}));
                list.forEach(t=>{ const iso=this.normalizeLedgerDate(t.date); if(iso.slice(0,4)!==String(year))return; const o=sums[Number(iso.slice(5,7))-1]; if(!o)return; const a=Number(t.amount)||0; if(t.type==='Income')o.inc+=a; else if(['Expense','EMI','Installment'].includes(t.type))o.exp+=a; o.n++; });
                const nowKey=this.todayISO().slice(0,7); let rows='';
                for(let i=11;i>=0;i--){ const key=`${year}-${String(i+1).padStart(2,'0')}`; const o=sums[i]; if(key>nowKey&&!o.n)continue; const last=new Date(year,i+1,0).getDate(); const net=o.inc-o.exp;
                    rows+=`<button type="button" class="lmon-row${key===nowKey?' lmon-now':''}${o.n?'':' lmon-empty'}" onclick="app.openLedgerMonth('${key}')"><span class="lmon-m"><b>${new Date(year,i,1).toLocaleDateString('en-IN',{month:'short'})}</b><small>01.${String(i+1).padStart(2,'0')} ~ ${last}.${String(i+1).padStart(2,'0')}</small></span><span class="lmon-in">${this.fmtMoney0(o.inc)}</span><span class="lmon-out">${this.fmtMoney0(o.exp)}</span><span class="lmon-net${net<0?' neg':''}">${this.fmtMoney0(net)}</span></button>`; }
                return `<div class="lmon"><div class="lmon-head"><span></span><span>Income</span><span>Expenses</span><span>Net</span></div>${rows||'<p class="lx-none">No months to show for this year.</p>'}</div>`;
            }
            /** Total view: all-time figures and one row per year. */
            ledgerTotalHtml(list){
                const years=new Map(); let inc=0,exp=0,trf=0,first='',last='';
                list.forEach(t=>{ const iso=this.normalizeLedgerDate(t.date); const a=Number(t.amount)||0; const y=iso.slice(0,4)||'—'; const o=years.get(y)||{inc:0,exp:0,n:0};
                    if(t.type==='Income'){ inc+=a; o.inc+=a; } else if(['Expense','EMI','Installment'].includes(t.type)){ exp+=a; o.exp+=a; } else if(t.type==='Transfer')trf+=a; o.n++; years.set(y,o);
                    if(iso){ if(!first||iso<first)first=iso; if(!last||iso>last)last=iso; } });
                const fmtD=iso=>iso?new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—';
                const rows=[...years.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([y,o])=>`<button type="button" class="lmon-row" ${/^\d{4}$/.test(y)?`onclick="app.openLedgerYear(${y})"`:'disabled'}><span class="lmon-m"><b>${y}</b><small>${o.n.toLocaleString('en-IN')} entr${o.n===1?'y':'ies'}</small></span><span class="lmon-in">${this.fmtMoney0(o.inc)}</span><span class="lmon-out">${this.fmtMoney0(o.exp)}</span><span class="lmon-net${o.inc-o.exp<0?' neg':''}">${this.fmtMoney0(o.inc-o.exp)}</span></button>`).join('');
                // The totals bar above already shows all-time income, expenses and net, so this card shows monthly averages.
                const months=first&&last?(Number(last.slice(0,4))-Number(first.slice(0,4)))*12+Number(last.slice(5,7))-Number(first.slice(5,7))+1:0; const avg=v=>months?v/months:0;
                return `<div class="ltot"><div class="ltot-card"><div><span>Avg. income / month</span><b class="ip-pos">${this.fmtMoney0(avg(inc))}</b></div><div><span>Avg. spending / month</span><b class="ip-neg">${this.fmtMoney0(avg(exp))}</b></div><div><span>Avg. net / month</span><b class="${inc-exp<0?'ip-neg':''}">${this.fmtMoney0(avg(inc-exp))}</b></div><div><span>Transfers</span><b>${this.fmtMoney0(trf)}</b></div></div>
                <p class="ltot-span">${list.length.toLocaleString('en-IN')} entr${list.length===1?'y':'ies'} over ${months} month${months===1?'':'s'} · ${fmtD(first)} – ${fmtD(last)}</p></div>
                <div class="lmon"><div class="lmon-head"><span>Year</span><span>Income</span><span>Expenses</span><span>Net</span></div>${rows||'<p class="lx-none">No transactions yet.</p>'}</div>`;
            }
            /** One compact ledger row: category on the left, payee and account in the middle, the amount on the right. */
            ledgerRowHtml(t,jsId){
                const esc=v=>this.escapeHtml(String(v??'')); const cat=t.category||'Uncategorized';
                const kind=t.type==='Income'?'lx-in':t.type==='Transfer'?'lx-tr':'lx-out';
                const acct=t.type==='Transfer'&&(t.destinationAccount||t.toAccount)?`${esc(t.account)} → ${esc(t.destinationAccount||t.toAccount)}`:esc(t.account);
                const note=t.notes||t.note||'';
                const badges=`${t.excludedFromLedger?` <span title="${esc(t.duplicateReason||'Excluded from totals')}" class="lx-badge">${t.duplicateOf?'Duplicate':'Excluded'}</span>`:''}${this.cardBadge(t)}${this.reconBadge(t)}${t.recurringScheduleId||t.recurringSalaryMonth?` <span class="lx-badge lx-badge-rep" title="Added by a schedule">↻</span>`:''}`;
                return `<tr class="lx${t.excludedFromLedger?' lx-excluded':''}" data-id="${esc(t.id)}" title="Tap for actions" tabindex="0" role="button" onclick="if(!event.target.closest('button,input,label,a,select')) app.openTxActions('${jsId(t.id)}')" onkeydown="if((event.key==='Enter'||event.key===' ') && !event.target.closest('button,input,label,a,select')){event.preventDefault();app.openTxActions('${jsId(t.id)}')}"><td colspan="8"><div class="lx-row">
                    <label class="lx-sel" onclick="event.stopPropagation()"><input type="checkbox" class="ledger-row-select" value="${esc(t.id)}" ${this.selectedTransactionIds?.has(String(t.id))?'checked':''} onchange="app.toggleTransactionSelection('${jsId(t.id)}',this.checked)" aria-label="Select transaction"></label>
                    <div class="lx-cat"><i class="cat-dot" style="--c:${this.categoryColor(cat)}"></i><span><b>${esc(cat)}</b>${t.subcategory?`<small>${esc(t.subcategory)}</small>`:''}</span></div>
                    <div class="lx-main"><b class="lx-payee">${esc(t.payee||t.description||note||'—')}</b>${badges}<small class="lx-sub">${acct}${note&&note!==(t.payee||t.description)?` · ${esc(note)}`:''}</small></div>
                    <div class="lx-amt ${kind}">${this.fmtMoney(t.amount)}${['Transfer','EMI','Installment'].includes(t.type)?`<small>${esc(t.type)}</small>`:''}</div>
                </div></td></tr>`;
            }
            /** Tap a row: a small sheet with the entry's details and Edit, Exclude/Restore, Copy and Delete. */
            openTxActions(id){
                const t=this.data.tx.find(x=>String(x.id)===String(id)); if(!t)return;
                const esc=v=>this.escapeHtml(String(v??'')); const jid=esc(String(t.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'"));
                const iso=this.normalizeLedgerDate(t.date); const when=iso?new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'}):esc(t.date);
                const kind=t.type==='Income'?'lx-in':t.type==='Transfer'?'lx-tr':'lx-out';
                const rows=[['Date',when],['Type',esc(t.type)],['Account',t.type==='Transfer'&&t.destinationAccount?`${esc(t.account)} → ${esc(t.destinationAccount)}`:esc(t.account)],['Category',`<i class="cat-dot" style="--c:${this.categoryColor(t.category)}"></i>${esc(t.category||'Uncategorized')}${t.subcategory?' / '+esc(t.subcategory):''}`],...(t.notes||t.note?[['Note',esc(t.notes||t.note)]]:[]),...(t.description&&t.description!==t.payee?[['Description',esc(t.description)]]:[])];
                document.getElementById('modal-box').innerHTML=`<div class="more-head"><h3 class="font-bold text-lg min-w-0 truncate">${esc(t.payee||t.description||'Transaction')}</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                <div class="txa-amt ${kind}">${this.fmtMoney(t.amount)}${t.excludedFromLedger?` <span class="lx-badge">${t.duplicateOf?'Duplicate':'Excluded'}</span>`:''}</div>
                <dl class="txa-info">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
                <div class="txa-actions"><button type="button" class="s-btn s-primary" onclick="app.closeModal();app.editTransaction('${jid}')"><i data-lucide="pencil"></i><span>Edit</span></button><button type="button" class="s-btn s-secondary" onclick="app.closeModal();app.copyTransaction('${jid}')"><i data-lucide="copy"></i><span>Copy</span></button><button type="button" class="s-btn s-secondary" onclick="app.closeModal();app.toggleLedgerExclusion('${jid}')"><i data-lucide="${t.excludedFromLedger?'rotate-ccw':'archive'}"></i><span>${t.excludedFromLedger?'Restore':'Exclude'}</span></button><button type="button" class="s-btn s-danger-outline" onclick="app.closeModal();app.deleteTransaction('${jid}')"><i data-lucide="trash-2"></i><span>Delete</span></button></div>`;
                const mc=document.getElementById('modal-container'); mc.classList.add('more-sheet'); mc.classList.remove('hidden'); window.lucide?.createIcons?.();
            }
            /** The category used most in the latest 200 entries of this kind (income, or spending). */
            lastCategoryFor(type){ const kinds=type==='Income'?['Income']:['Expense','EMI','Installment']; const n=new Map(); let seen=0;
                for(const t of (this.data?.tx||[])){ if(!t||t.excludedFromLedger||!kinds.includes(t.type)||!t.category)continue; n.set(t.category,(n.get(t.category)||0)+1); if(++seen>=200)break; }
                let best='',max=0; n.forEach((v,k)=>{ if(v>max){ max=v; best=k; } }); return best; }
            /** Copy: the Add form filled in from this entry, dated today. */
            copyTransaction(id){ const t=this.data.tx.find(x=>String(x.id)===String(id)); if(!t)return; this.openTransactionModal({type:t.type,amount:t.amount,payee:t.payee||t.description||'',category:t.category,subcategory:t.subcategory,account:t.account,destinationAccount:t.destinationAccount,note:t.notes||t.note||''}); }
            /**
             * Returns or checks  filtered ledger.
             * Parameters: opts.period overrides the month shown ('all' or 'YYYY-MM'); without it the Daily view's month and day apply.
             */
            getFilteredLedger(opts={}) {
                const scoped=opts.period===undefined;
                const period=scoped?(this.ledgerViewName()==='daily'?this.ledgerMonth():'all'):opts.period;
                const day=scoped&&this.ledgerViewName()==='daily'?(this.ledgerDay||''):'';
                const catFilter=this.ledgerCategory||'';
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
                    const matchPeriod=period==='all'||iso.slice(0,7)===period;
                    const matchDay=!day||iso===day;
                    const matchCat=!catFilter||(t.category||'Uncategorized')===catFilter;
                    return matchSearch && matchType && matchYear && matchMonth && matchFrom && matchTo && matchPeriod && matchDay && matchCat;
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
                const view=this.ledgerViewName(); this.renderLedgerPeriodBar(view);
                // What the totals cover: Daily = the month (or day) in the list; Calendar = the month; Monthly = the year; Total = everything.
                const calMonth=this.ledgerMonth()==='all'?this.todayISO().slice(0,7):this.ledgerMonth(); const year=this.ledgerYearView||new Date().getFullYear();
                let filtered;
                if(view==='daily') filtered=this.getFilteredLedger();
                else { const base=this.getFilteredLedger({period:'all'}); filtered=view==='calendar'?base.filter(t=>this.normalizeLedgerDate(t.date).slice(0,7)===calMonth):view==='monthly'?base.filter(t=>this.normalizeLedgerDate(t.date).slice(0,4)===String(year)):base; }
                const income=filtered.filter(t=>t.type==='Income').reduce((sum,t)=>sum+(Number(t.amount)||0),0);
                const expense=filtered.filter(t=>['Expense','EMI','Installment'].includes(t.type)).reduce((sum,t)=>sum+(Number(t.amount)||0),0);
                const transfers=filtered.filter(t=>t.type==='Transfer').reduce((sum,t)=>sum+(Number(t.amount)||0),0);
                const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
                setText('ledger-total-count',filtered.length.toLocaleString('en-IN'));
                setText('ledger-total-income',this.fmtMoney(income));
                setText('ledger-total-expense',this.fmtMoney(expense));
                setText('ledger-total-transfer',this.fmtMoney(transfers));
                setText('ledger-total-net',this.fmtMoney(income-expense));
                const alt=document.getElementById('ledger-alt'); const listWrap=document.getElementById('ledger-list-wrap'); const bulkBar=document.getElementById('ledger-bulk-bar');
                if(view!=='daily'){
                    if(alt){ alt.hidden=false; alt.innerHTML=view==='calendar'?this.ledgerCalendarHtml(filtered,calMonth):view==='monthly'?this.ledgerMonthlyHtml(filtered,year):this.ledgerTotalHtml(filtered); }
                    if(listWrap)listWrap.hidden=true; if(bulkBar)bulkBar.hidden=true;
                    this.selectedTransactionIds=new Set(); this.syncLedgerBulkBar(); tbody.innerHTML='';
                    return window.lucide?.createIcons?.();
                }
                if(alt){ alt.hidden=true; alt.innerHTML=''; } if(listWrap)listWrap.hidden=false;
                // Long ledgers are shown 150 entries at a time ("Show more" adds the next 150). Drawing thousands of rows at once
                // took 15+ seconds on mid-range phones. Totals above still cover every matching entry.
                const pageSize=150; if(!this.ledgerShown)this.ledgerShown=pageSize;
                const shownList=filtered.slice(0,this.ledgerShown);
                // Selection only ever covers rows currently on screen, so bulk actions never touch hidden or excluded entries by accident.
                const visibleIds=new Set(shownList.map(t=>String(t.id)));
                this.selectedTransactionIds=new Set([...(this.selectedTransactionIds||[])].filter(id=>visibleIds.has(id)));
                const jsId=id=>this.escapeHtml(String(id??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"));
                tbody.innerHTML = this.ledgerRowsWithDayHeaders(shownList, t => this.ledgerRowHtml(t,jsId));
                if(filtered.length>shownList.length){ const left=filtered.length-shownList.length; tbody.insertAdjacentHTML('beforeend',`<tr class="ledger-more"><td colspan="8" class="py-4 text-center"><button type="button" class="s-btn s-secondary" onclick="app.showMoreLedger()">Show ${Math.min(pageSize,left)} more · ${left.toLocaleString('en-IN')} older entr${left===1?'y':'ies'}</button></td></tr>`); }
                // Empty filtered view: say so instead of leaving a blank list.
                if(!filtered.length){ const mode=document.getElementById('ledger-excluded-filter')?.value||'active'; const month=this.ledgerMonth();
                    const where=this.ledgerDay?' on this day':month!=='all'?` in ${this.monthLabel(month,true)}`:'';
                    const filtersOn=this.ledgerActiveFilters().some(a=>!a.always)||!!this.ledgerCategory||!!document.getElementById('ledger-search')?.value;
                    const msg={excluded:`No excluded transactions${where}. Entries you exclude appear here so you can restore them.`,duplicates:`No SMS duplicates found${where}.`}[mode]||(filtersOn?`No transactions match the current filters${where}.`:`No transactions${where}.`);
                    const more=month!=='all'&&(this.data.tx||[]).length?`<div class="mt-3"><button type="button" class="s-btn s-secondary" onclick="app.setLedgerPeriod('all')">Show all months</button></div>`:'';
                    tbody.innerHTML=`<tr class="lx-empty"><td colspan="8" class="py-8 text-center text-sm text-slate-500">${msg}${more}</td></tr>`; }
                if(bulkBar)bulkBar.hidden=!filtered.length;
                const selectAll=document.getElementById('ledger-select-all');
                if(selectAll){selectAll.checked=shownList.length>0 && shownList.every(t=>this.selectedTransactionIds?.has(String(t.id)));selectAll.indeterminate=shownList.some(t=>this.selectedTransactionIds?.has(String(t.id)))&&!selectAll.checked;}
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
             * Parameters: msg, {undo, action:{label, run}, ms}.
             */
            showToast(msg,{undo,action,ms=6000}={}){
                document.getElementById('app-toast')?.remove(); clearTimeout(this._toastTimer);
                const el=document.createElement('div'); el.id='app-toast'; el.setAttribute('role','status');
                const btn=undo?{label:'Undo',run:undo}:action;
                el.innerHTML=`<span></span>${btn?'<button type="button"></button>':''}`; el.firstChild.textContent=msg;
                if(btn){ const b=el.querySelector('button'); b.textContent=btn.label; b.onclick=()=>{ el.remove(); clearTimeout(this._toastTimer); btn.run(); }; }
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
            toggleSelectAll(checked){this.selectedTransactionIds ||= new Set();this.getFilteredLedger().slice(0,this.ledgerShown||150).forEach(t=>{if(checked)this.selectedTransactionIds.add(String(t.id));else this.selectedTransactionIds.delete(String(t.id));});this.renderLedger();}
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
            filterLedger() { this.ledgerShown = 0; this.renderLedger(); }
            /** Search box: wait until typing pauses, then filter (re-filtering on every keystroke was slow with long ledgers). */
            filterLedgerSoon() { clearTimeout(this._ledgerSearchTimer); this._ledgerSearchTimer = setTimeout(() => this.filterLedger(), 250); }
            /** "Show more" at the end of the ledger: adds the next 150 entries. */
            showMoreLedger() { this.ledgerShown = (this.ledgerShown || 150) + 150; this.renderLedger(); }

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
                <div><label class="text-xs font-semibold text-slate-500">Amount${CURL()}</label><input id="edit-tx-amount" type="number" min="0.01" step="0.01" required value="${esc(t.amount)}" class="w-full px-3 py-2 rounded-xl border dark:bg-slate-800"><button type="button" onclick="app.openAmountCalculator('edit-tx-amount')" class="mt-1 text-xs text-emerald-600 hover:underline">🧮 Calculator</button></div>
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
             * Builds the transaction-entry form: Expense / Income / Transfer at the top, then one labelled row per field,
             * then Repeat and Installments. Parameters: prefill (optional) — values for Copy.
             */
            openTransactionModal(prefill) {
                const p=prefill&&typeof prefill==='object'?prefill:{}; const esc=v=>this.escapeHtml(String(v??''));
                const accounts=this.data.accounts||[]; const def=p.account||this.getGlobalDefaultAccount()?.name||accounts[0]?.name||'';
                // Your categories, plus any that only your transactions use (imports, older data), so every one can be picked
                const cats=[...new Set([...(this.data.categories||[]),...(this.data.tx||[]).map(t=>t&&t.type!=='Transfer'&&t.category).filter(Boolean),...(p.category?[p.category]:[])])];
                const acctOpts=sel=>accounts.map(a=>`<option value="${esc(a.name)}" ${String(a.name)===String(sel)?'selected':''}>${esc(a.name)}</option>`).join('');
                const type=['Expense','Income','Transfer','EMI','Installment'].includes(p.type)?p.type:'Expense';
                const box = document.getElementById('modal-box');
                box.innerHTML = `
                    <div class="flex justify-between items-center pb-2">
                        <h3 class="font-bold text-base" id="af-title">${p.type?'Copy transaction':'New transaction'}</h3>
                        <button type="button" onclick="app.closeModal()" class="text-slate-400 hover:text-slate-600" aria-label="Close"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    <form id="af-form" onsubmit="app.saveNewTransaction(event)" class="af-form" data-type="${type}">
                        <div class="af-types" role="tablist" aria-label="Transaction type">
                            <button type="button" role="tab" data-t="Income">Income</button>
                            <button type="button" role="tab" data-t="Expense">Expense</button>
                            <button type="button" role="tab" data-t="Transfer">Transfer</button>
                            <select id="af-more-type" aria-label="Other types"><option value="">More</option><option value="EMI">EMI</option><option value="Installment">Installment</option></select>
                        </div>
                        <select id="modal-tx-type" hidden aria-hidden="true" tabindex="-1">${['Expense','Income','Transfer','EMI','Installment'].map(x=>`<option value="${x}" ${x===type?'selected':''}>${x}</option>`).join('')}</select>
                        <label class="af-row"><span>Date</span><input type="date" id="modal-tx-date" required value="${this.todayISO()}"></label>
                        <label class="af-row af-amount"><span>Amount${CURL()}</span><input type="number" step="0.01" min="0.01" id="modal-tx-amount" data-money="0" required inputmode="decimal" placeholder="0.00" value="${p.amount?esc(p.amount):''}"><button type="button" class="af-calc" onclick="app.openAmountCalculator('modal-tx-amount')" aria-label="Calculator">🧮</button></label>
                        <label class="af-row" data-show="cat"><span>Category</span><span class="af-cat"><i class="cat-dot" id="af-cat-dot"></i><select id="modal-tx-category">${cats.map(c=>`<option value="${esc(c)}" ${c===p.category?'selected':''}>${esc(c)}</option>`).join('')}</select></span></label>
                        <label class="af-row" data-show="cat"><span>Subcategory</span><input id="modal-tx-subcategory" list="af-sub-options" placeholder="Optional" value="${esc(p.subcategory||'')}"><datalist id="af-sub-options"></datalist></label>
                        <label class="af-row"><span id="af-account-label">Account</span><select id="modal-tx-account">${acctOpts(def)}</select></label>
                        <label class="af-row" id="modal-tx-destination-wrap" data-show="to"><span>To</span><select id="modal-tx-destination">${accounts.map(a=>`<option value="${esc(a.name)}" ${String(a.name)===String(p.destinationAccount||'')?'selected':''}>${esc(a.name)} (${esc(a.type||'Account')})</option>`).join('')}</select></label>
                        <label class="af-row"><span>Payee</span><input type="text" id="modal-tx-payee" required placeholder="Shop or person" value="${esc(p.payee||'')}"></label>
                        <label class="af-row"><span>Note</span><input type="text" id="modal-tx-note" placeholder="Optional" value="${esc(p.note||'')}"></label>
                        <div class="af-section">
                            <label class="af-row"><span>Repeat</span><select id="af-repeat"><option value="">Never</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="quarterly">Every 3 months</option><option value="yearly">Every year</option></select></label>
                            <div class="af-row" id="af-ends-row" hidden><span>Ends</span><span class="af-ends"><select id="af-ends" aria-label="Repeat ends"><option value="never">Never</option><option value="date">On date</option><option value="count">After</option></select><input type="date" id="af-ends-date" aria-label="Last date" hidden><input type="number" id="af-ends-count" data-money="0" min="1" max="600" step="1" value="12" aria-label="Number of times" hidden><em id="af-ends-unit" hidden>times</em></span></div>
                            <label class="af-row" id="af-inst-row" data-show="inst"><span>Installments</span><select id="af-inst"><option value="">None (pay in full)</option>${[2,3,4,5,6,9,12,15,18,24,36].map(n=>`<option value="${n}">${n} months</option>`).join('')}</select></label>
                            <p id="af-hint" class="af-hint" hidden></p>
                        </div>
                        <div class="af-actions">
                            <button type="button" onclick="app.closeModal()" class="s-btn s-secondary">Cancel</button>
                            <button type="submit" class="s-btn s-primary" id="af-save">Save</button>
                        </div>
                    </form>
                `;
                document.getElementById('modal-container').classList.remove('hidden');
                const $=id=>document.getElementById(id); const form=$('af-form');
                const typeSel=$('modal-tx-type'), src=$('modal-tx-account'), dst=$('modal-tx-destination'), catSel=$('modal-tx-category');
                const subsFor=()=>{ const subs=this.categorySubcategoryMap()[catSel.value]; $('af-sub-options').innerHTML=(Array.isArray(subs)?subs:[]).map(s=>`<option value="${esc(typeof s==='string'?s:s.name)}">`).join(''); $('af-cat-dot').style.setProperty('--c',this.categoryColor(catSel.value)); };
                const sync=()=>{
                    const t=typeSel.value; form.dataset.type=t; const transfer=t==='Transfer', expenseLike=['Expense','EMI','Installment'].includes(t);
                    form.querySelectorAll('.af-types [data-t]').forEach(b=>{ const on=b.dataset.t===t; b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on)); });
                    const more=$('af-more-type'); more.classList.toggle('on',['EMI','Installment'].includes(t)); more.value=['EMI','Installment'].includes(t)?t:'';
                    form.querySelectorAll('[data-show="cat"]').forEach(r=>{ r.hidden=transfer; }); $('modal-tx-destination-wrap').hidden=!transfer; $('af-account-label').textContent=transfer?'From':'Account';
                    if(transfer&&dst.value===src.value){ const other=[...dst.options].find(o=>o.value!==src.value); if(other)dst.value=other.value; }
                    $('af-inst-row').hidden=!expenseLike; if(!expenseLike)$('af-inst').value='';
                    const inst=Number($('af-inst').value)||0; const rep=$('af-repeat').value;
                    $('af-repeat').disabled=inst>1; if(inst>1)$('af-repeat').value='';
                    $('af-ends-row').hidden=!rep||inst>1; const ends=$('af-ends').value; $('af-ends-date').hidden=ends!=='date'; $('af-ends-count').hidden=ends!=='count'; $('af-ends-unit').hidden=ends!=='count';
                    $('af-ends-date').required=!$('af-ends-row').hidden&&ends==='date';
                    // What will happen, in words
                    const amt=Number($('modal-tx-amount').value)||0; const d=$('modal-tx-date').value; const when=d?new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'';
                    let hint='';
                    if(inst>1){ const each=Math.floor(amt/inst*100)/100; hint=amt?`${inst} monthly installments of ${this.fmtMoney(each)} from ${when}${Math.abs(each*inst-amt)>0.001?` (the last one is ${this.fmtMoney(Math.round((amt-each*(inst-1))*100)/100)})`:''}. They are listed in Schedules and appear in the ledger as each one falls due.`:`Split the amount into ${inst} monthly installments.`; }
                    else if(rep){ hint=`${this.frequencyLabel(rep)} from ${when}${ends==='count'?`, ${Number($('af-ends-count').value)||1} times in all`:ends==='date'&&$('af-ends-date').value?`, until ${new Date($('af-ends-date').value+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`:''}. Saved as a schedule; each entry is added to the ledger on its date.`; }
                    $('af-hint').hidden=!hint; $('af-hint').textContent=hint;
                    $('af-save').textContent=inst>1?'Save installments':rep?'Save and repeat':'Save';
                };
                // Until the person picks a category, follow the type: the category they use most for income, or for spending.
                let catTouched=!!p.category;
                const pickCat=()=>{ if(catTouched||typeSel.value==='Transfer')return; const c=this.lastCategoryFor(typeSel.value)||(typeSel.value==='Income'?cats.find(x=>/salary|income/i.test(x))||'':''); if(c&&[...catSel.options].some(o=>o.value===c)){ catSel.value=c; subsFor(); } };
                form.querySelectorAll('.af-types [data-t]').forEach(b=>b.addEventListener('click',()=>{ typeSel.value=b.dataset.t; pickCat(); sync(); }));
                $('af-more-type').addEventListener('change',e=>{ if(e.target.value){ typeSel.value=e.target.value; } pickCat(); sync(); });
                catSel.addEventListener('change',()=>{ catTouched=true; subsFor(); }); [src,dst,$('af-repeat'),$('af-ends'),$('af-inst')].forEach(el=>el.addEventListener('change',sync));
                [$('modal-tx-amount'),$('modal-tx-date'),$('af-ends-count'),$('af-ends-date')].forEach(el=>el.addEventListener('input',sync));
                subsFor(); pickCat(); sync();
                window.lucide?.createIcons?.();
                setTimeout(()=>{ if(window.matchMedia('(pointer: fine)').matches)$('modal-tx-amount')?.focus(); },50);
            }

            /**
             * Validates and saves a new ledger transaction, including related balance effects.
             * With Repeat or Installments it saves a schedule instead, and the schedule posts each entry on its date.
             * Parameters: event. Side effects, if any, are described by the statements below.
             */
            saveNewTransaction(event) {
                event.preventDefault();
                const val=id=>document.getElementById(id)?.value??'';
                const type = val('modal-tx-type')||'Expense';
                const amount = parseFloat(val('modal-tx-amount'));
                const payee = val('modal-tx-payee').trim();
                const transfer = type==='Transfer';
                const category = transfer?'Transfer':(val('modal-tx-category')||'Uncategorized');
                const subcategory = transfer?'':val('modal-tx-subcategory').trim();
                const note = val('modal-tx-note').trim();
                const account = val('modal-tx-account') || this.getGlobalDefaultAccount()?.name || '';
                const date = val('modal-tx-date');
                if (!Number.isFinite(amount) || amount <= 0) return alert('Enter an amount greater than zero.');
                if (!account || !date) return alert('Select an account and date.');
                const destinationAccount = transfer ? val('modal-tx-destination') : '';
                if (transfer && (!destinationAccount || destinationAccount === account)) return alert('Choose a destination account that is different from the source account.');
                if (this.isLockedDate(date)) return this.lockedAlert(date);
                const inst=Number(val('af-inst'))||0, repeat=val('af-repeat');
                if (inst>1 || repeat) {
                    const src=this.data.accounts.find(a=>a.name===account), dst=transfer?this.data.accounts.find(a=>a.name===destinationAccount):null;
                    const ends=val('af-ends'), count=inst>1?0:ends==='count'?Math.max(1,Math.round(Number(val('af-ends-count'))||1)):0, endDate=inst>1?'':ends==='date'?val('af-ends-date'):'';
                    if (endDate && endDate < date) return alert('The last date must be on or after the first date.');
                    const each=inst>1?Math.floor(amount/inst*100)/100:amount;
                    const item={id:'sched_'+Date.now(),title:payee,payee,note,amount:each,sourceAccount:String(src?.id||account),sourceAccountName:account,
                        destinationType:transfer?'account':'category',destinationAccount:dst?String(dst.id||dst.name):'',destinationAccountName:dst?dst.name:'',
                        transactionType:inst>1?(type==='EMI'?'EMI':'Installment'):type,category:transfer?'Transfer':category,subcategory:transfer?'Scheduled Transfer':subcategory,
                        frequency:inst>1?'monthly':repeat,startDate:date,endDate,dueDate:date,day:Math.min(28,Number(date.slice(8,10))||1),enabled:true,createdFrom:'add-form',
                        ...(inst>1?{installments:{count:inst,total:Math.round(amount*100)/100}}:{}),...(count?{count}:{})};
                    const limit=this.scheduleLimit(item); if(limit&&!item.endDate)item.endDate=this.todayISO(this.scheduleOccurrence(item,limit-1));
                    if(!transfer)this.ensureCategoryAndSubcategory(category,subcategory);
                    this.data.yearly ||= []; this.data.yearly.push(item);
                    this.processRecurringPayments();
                    const flagged = this.autoFlagSmsDuplicates();
                    this.saveVault(); this.renderAll(); this.closeModal();
                    const first=date>this.todayISO()?` The first one is added on ${new Date(date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})}.`:'';
                    this.showToast(inst>1?`Saved ${inst} installments. Find them in Schedules.${first}`:`Saved. ${this.frequencyLabel(repeat)} — find it in Schedules.${first}`);
                    if (flagged) alert(this.smsDuplicateNotice(flagged));
                    return;
                }
                const newTx = { id: 'tx_' + Date.now(), uid: this.newUid(), date, type, amount, account, category, ...(subcategory?{subcategory}:{}), payee, notes: note, ...(note?{note}:{}), ...(destinationAccount ? { destinationAccount } : {}) };
                if(!transfer)this.ensureCategoryAndSubcategory(category,subcategory);
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
