// AificoApp methods: dashboard (6 methods). Part of the AificoApp prototype chain.
        class AificoAppDashboard extends AificoAppLedger {
            /**
             * Renders the  dashboard UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderDashboard() {
                const num = v => { if (typeof v === 'string') v=v.replace(/[₹,\s]/g,''); const n=Number(v); return Number.isFinite(n) ? n : 0; };
                const assetTypes = ['Receivable','Checking','Cash','Savings','Savings Account','Investment','Investment Account','Fixed Deposit','Fixed Deposit Account','Recurring Deposit','RD','RD Account'];
                const liabilityTypes = ['Loan Account','Loan']; // credit card dues are excluded: card spends hit net worth only when the bill is paid
                const assets = this.data.accounts.filter(a => assetTypes.includes(a.type)).reduce((sum,a)=>sum+num(a.balance),0);
                const liabilities = this.data.accounts.filter(a => liabilityTypes.includes(a.type)).reduce((sum,a)=>sum+Math.abs(num(a.balance)),0);
                const netWorth = assets - liabilities;
                const liquid = this.data.accounts.filter(a => ['Checking','Cash','Savings','Savings Account'].includes(a.type)).reduce((sum,a)=>sum+num(a.balance),0);
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                const inMonth = t => (this.parseLedgerDate(t.date)||'').slice(0,7) === monthKey;
                const income = this.countedTx().filter(t => t.type === 'Income' && inMonth(t)).reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                const expense = this.countedTx().filter(t => (['Expense','EMI','Installment'].includes(t.type)) && inMonth(t)).reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                const suspiciousAccounts = this.data.accounts.filter(a => !Number.isFinite(Number(a.balance)) || Math.abs(num(a.balance)) >= 1000000000);
                const suspiciousTx = this.data.tx.filter(t => !Number.isFinite(Number(t.amount)) || Math.abs(num(t.amount)) >= 1000000000);
                let warning = document.getElementById('dashboard-calculation-warning');
                if (!warning) { warning=document.createElement('div'); warning.id='dashboard-calculation-warning'; warning.className='mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900'; document.querySelector('#panel-dashboard')?.prepend(warning); }
                const moneyDashboard = v => `${CUR()}${num(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                warning.classList.toggle('hidden', !(suspiciousAccounts.length || suspiciousTx.length));
                if (suspiciousAccounts.length || suspiciousTx.length) {
                    const accountDetails = suspiciousAccounts.map(a => `<li><strong>${this.escapeHtml(a.name||'Unnamed account')}</strong> (${this.escapeHtml(a.type||'Unknown type')}): ${moneyDashboard(a.balance)}</li>`).join('');
                    const txDetails = suspiciousTx.slice(0,8).map(t => `<li>${this.escapeHtml(t.date||'No date')} · ${this.escapeHtml(t.payee||t.description||t.notes||'Transaction')} · ${moneyDashboard(t.amount)}</li>`).join('');
                    const accountActions = suspiciousAccounts.map((a, accountIndex) => `<li class="mb-2"><strong>${this.escapeHtml(a.name||'Unnamed account')}</strong> (${this.escapeHtml(a.type||'Unknown type')}): ${moneyDashboard(a.balance)} <button type="button" class="ml-2 underline font-semibold" onclick="app.rebuildAccountBalanceFromLedgerByIndex(${this.data.accounts.indexOf(a)})">Rebuild from ledger</button> <button type="button" class="ml-2 underline" onclick="app.reconcileAccountBalanceByIndex(${this.data.accounts.indexOf(a)})">Set verified balance</button> <button type="button" class="ml-2 underline" onclick="app.openAccountLedgerEntriesByIndex(${this.data.accounts.indexOf(a)})">Inspect ledger entries</button></li>`).join('');
                    warning.innerHTML = `<div class="font-semibold mb-1">Dashboard totals need review</div><p class="mb-2">Found ${suspiciousAccounts.length} account balance(s) and ${suspiciousTx.length} transaction amount(s) that are invalid or unusually large (${CUR()}1 billion or more). No data has been changed automatically.</p>${accountActions?`<div class="font-semibold">Accounts to check</div><ul class="list-disc pl-5 mb-2">${accountActions}</ul>`:''}${txDetails?`<div class="font-semibold">Example transactions to check</div><ul class="list-disc pl-5 mb-2">${txDetails}</ul>`:''}<p class="text-xs mb-2">Use “Set verified balance” only after checking your actual bank statement. This changes the account's stored balance; it does not delete or rewrite ledger history.</p><button type="button" class="underline font-semibold" onclick="app.openDashboardDrilldown('Account balances to review','accounts-networth')">Open account breakdown</button>`;
                }
                const netEl=document.getElementById('kpi-net-worth'), liquidEl=document.getElementById('kpi-liquid');
                netEl.innerText = suspiciousAccounts.length ? 'Review data' : moneyDashboard(netWorth);
                liquidEl.innerText = suspiciousAccounts.some(a=>['Checking','Cash','Savings','Savings Account'].includes(a.type)) ? 'Review data' : moneyDashboard(liquid);
                document.getElementById('kpi-income').innerText = `${CUR()}${income.toLocaleString('en-IN', {minimumFractionDigits: 2,maximumFractionDigits:2})}`;
                document.getElementById('kpi-expense').innerText = `${CUR()}${expense.toLocaleString('en-IN', {minimumFractionDigits: 2,maximumFractionDigits:2})}`;
                this.renderMonthlyComparison();
                const tbody = document.getElementById('dashboard-tx-tbody');
                // Latest five by date (not by when they were typed in). Money in shows +, money out −, a move between your own accounts no sign.
                const recent=[...this.countedTx()].sort((a,b)=>(this.normalizeLedgerDate(b.date)||'').localeCompare(this.normalizeLedgerDate(a.date)||'')).slice(0,5);
                const sign=t=>t.type==='Income'||(t.type==='Transfer'&&t.transferDirection==='in')?'+':t.type==='Transfer'&&t.transferDirection!=='out'?'':'−';
                tbody.innerHTML = recent.map(t => `<tr title="Open transaction details" class="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onclick="app.editTransaction('${String(t.id).replace(/'/g, '\\\'')}')"><td class="py-3 text-slate-500">${this.escapeHtml(t.date||'')}</td><td class="py-3 font-medium">${this.escapeHtml(t.payee||t.description||'')}</td><td class="py-3"><span class="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800">${this.escapeHtml(t.category||'Uncategorized')}</span></td><td class="py-3 text-slate-500">${this.escapeHtml(t.account||'')}</td><td class="py-3 text-right font-semibold whitespace-nowrap ${sign(t)==='+'?'text-emerald-600':'text-slate-800 dark:text-slate-200'}">${sign(t)}${CUR()}${num(t.amount).toLocaleString('en-IN')}</td></tr>`).join('');
                const remList = document.getElementById('reminders-list');
                // Upcoming = enabled schedules that still have a next date, soonest first; Due shows that next date.
                const nextOf=y=>{ try{ return y.startDate&&this.scheduleProgress?this.scheduleProgress(y,0).next:''; }catch(e){ return ''; } };
                const scheduledItems = (Array.isArray(this.data.yearly)?this.data.yearly:[]).filter(y=>y.enabled!==false).map(y=>({y,next:nextOf(y)})).filter(x=>x.next||!x.y.startDate).sort((a,b)=>(a.next||'9999').localeCompare(b.next||'9999')).map(x=>({...x.y,__next:x.next}));
                remList.innerHTML = scheduledItems.map(y => {
                    const due = y.__next ? new Date(y.__next+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : (y.startDate || y.dueDate || 'Not set');
                    const mode = y.destinationType || (y.sourceAccount && y.destinationAccount ? 'account' : 'legacy');
                    let destination = '';
                    if (mode === 'account') destination = `To account: ${this.escapeHtml(y.destinationAccountName || y.destinationAccount || 'Destination account')}`;
                    else if (mode === 'category') destination = `Category: ${this.escapeHtml(y.category || 'Uncategorized')}${y.subcategory ? ' / '+this.escapeHtml(y.subcategory) : ''} · ${this.escapeHtml(y.transactionType || 'Expense')}`;
                    else destination = 'Legacy schedule · Edit in Yearly / Scheduled to configure destination';
                    const source = y.sourceAccountName ? `From: ${this.escapeHtml(y.sourceAccountName)} · ` : '';
                    const frequency = y.frequency ? `${this.escapeHtml(y.frequency.charAt(0).toUpperCase()+y.frequency.slice(1))} · ` : '';
                    const status = mode === 'legacy' ? 'Needs setup' : 'Scheduled';
                    return `<div class="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800"><div class="min-w-0"><h4 class="font-medium text-sm">${this.escapeHtml(y.title||'')}</h4><p class="text-xs text-slate-500">Due: ${this.escapeHtml(due)} · ${frequency}${source}${destination}</p><p class="text-xs ${mode==='legacy'?'text-amber-600':'text-emerald-600'} mt-1">${status}</p></div><span class="font-bold text-sm shrink-0">${CUR()}${num(y.amount).toLocaleString('en-IN')}</span></div>`;
                }).join('') || '<p class="text-sm text-slate-500">No upcoming reminders.</p>';
                this.renderCharts(income, expense);
            }

            /**
             * Renders the  monthly comparison UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderMonthlyComparison() {
                const num = v => { if (typeof v === 'string') v=v.replace(/[₹,\s]/g,''); const n=Number(v); return Number.isFinite(n) ? n : 0; };
                const now = new Date();
                const current = new Date(now.getFullYear(), now.getMonth(), 1);
                const previous = new Date(now.getFullYear(), now.getMonth()-1, 1);
                const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                const flowExpense = t => ['Expense','EMI','Installment'].includes(t.type);
                const totals = monthKey => {
                    const rows=this.countedTx().filter(t=>(this.parseLedgerDate(t.date)||'').slice(0,7)===monthKey);
                    const income=rows.filter(t=>t.type==='Income').reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                    const expense=rows.filter(flowExpense).reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                    return {income,expense,net:income-expense};
                };
                const cur=totals(key(current)), prev=totals(key(previous));
                const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
                const short=now.toLocaleDateString('en-IN',{month:'short'}), prevShort=previous.toLocaleDateString('en-IN',{month:'short'});
                document.querySelectorAll('#dash-kpis .dk-month').forEach(el=>{ el.textContent=short; });
                set('kpi-net',this.fmtMoney(cur.net));
                const netEl=document.getElementById('kpi-net'); if(netEl)netEl.classList.toggle('dk-out',cur.net<0);
                // "▲ ₹2,499 · 1.7% vs Sep": green when it helps you (more income, less spending, higher net), red when it doesn't.
                const change=(id,a,b,higherIsGood)=>{ const el=document.getElementById(id); if(!el)return; const diff=a-b;
                    if(!a&&!b){ el.textContent=`Nothing yet in ${prevShort} or ${short}`; el.className='dk-s'; return; }
                    const pct=b?` · ${Math.abs(diff/Math.abs(b)*100).toFixed(Math.abs(diff/b)<0.1?1:0)}%`:'';
                    el.textContent=diff===0?`Same as ${prevShort}`:`${diff>0?'▲':'▼'} ${this.fmtMoney0(Math.abs(diff))}${pct} vs ${prevShort}`;
                    el.className='dk-s '+(diff===0?'':((diff>0)===higherIsGood?'dk-good':'dk-bad')); };
                change('kpi-income-change',cur.income,prev.income,true);
                change('kpi-expense-change',cur.expense,prev.expense,false);
                change('kpi-net-change',cur.net,prev.net,true);
            }

            /**
             * Opens the  dashboard drilldown screen, dialog, or workflow.
             * Parameters: title, mode, extra={}. Side effects, if any, are described by the statements below.
             */
            openDashboardDrilldown(title, mode, extra={}) {
                const num=v=>{if(typeof v==='string')v=v.replace(/[₹,\s]/g,'');const n=Number(v);return Number.isFinite(n)?n:0;};
                const money=v=>`${CUR()}${Math.abs(num(v)).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                const assetTypes=['Receivable','Checking','Cash','Savings','Savings Account','Investment','Investment Account','Fixed Deposit','Fixed Deposit Account','Recurring Deposit','RD','RD Account'];
                const liabilityTypes=['Loan Account','Loan'];
                const now=new Date(), monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                const inMonth=t=>(this.parseLedgerDate(t.date)||'').slice(0,7)===monthKey;
                let rows=[], kind='transactions';
                if(mode==='accounts-networth'||mode==='accounts-liquid'){
                    kind='accounts';
                    rows=this.data.accounts.filter(a=>mode==='accounts-networth'||['Checking','Cash','Savings','Savings Account'].includes(a.type));
                } else {
                    rows=this.countedTx().filter(t=>{
                        if(mode==='income-current')return t.type==='Income'&&inMonth(t);
                        if(mode==='expense-current')return inMonth(t)&&(['Expense','EMI','Installment'].includes(t.type));
                        if(mode==='month-type')return (this.parseLedgerDate(t.date)||'').slice(0,7)===extra.monthKey && (extra.type==='Income'?t.type==='Income':(['Expense','EMI','Installment'].includes(t.type)));
                        if(mode==='category')return inMonth(t)&&['Expense','EMI','Installment'].includes(t.type)&&(t.category||'Uncategorized')===extra.category;
                        if(mode==='category-period'){const d=this.parseLedgerDate(t.date)||'';return ['Expense','EMI','Installment'].includes(t.type)&&(t.category||'Uncategorized')===extra.category&&d.slice(0,4)===extra.year&&(extra.month==='all'||d.slice(5,7)===extra.month);}
                        return false;
                    }).sort((a,b)=>(this.parseLedgerDate(b.date)||'').localeCompare(this.parseLedgerDate(a.date)||''));
                }
                const box=document.getElementById('modal-box');
                const esc=v=>this.escapeHtml(String(v??''));
                const table=kind==='accounts' ? `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-slate-500 border-b"><th class="p-2">Account</th><th class="p-2">Type</th><th class="p-2 text-right">Balance</th></tr></thead><tbody>${rows.map(a=>`<tr class="border-b border-slate-100 dark:border-slate-800"><td class="p-2 font-medium">${esc(a.name)}</td><td class="p-2">${esc(a.type)}</td><td class="p-2 text-right font-semibold ${num(a.balance)<0?'text-rose-600':''}">${num(a.balance)<0?'-':''}${money(a.balance)}</td></tr>`).join('')||'<tr><td colspan="3" class="p-4 text-center text-slate-500">No accounts found.</td></tr>'}</tbody></table></div>` : `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-slate-500 border-b"><th class="p-2">Date</th><th class="p-2">Description</th><th class="p-2">Category</th><th class="p-2">Account</th><th class="p-2 text-right">Amount</th><th class="p-2">Action</th></tr></thead><tbody>${rows.map(t=>`<tr class="border-b border-slate-100 dark:border-slate-800"><td class="p-2 whitespace-nowrap">${esc(t.date||'')}</td><td class="p-2">${esc(t.payee||t.description||t.notes||'Transaction')}<div class="text-xs text-slate-400">${esc(t.type||'')}</div></td><td class="p-2">${esc(t.category||'Uncategorized')}${t.subcategory?' / '+esc(t.subcategory):''}</td><td class="p-2">${esc(t.account||'')}${t.destinationAccount?' → '+esc(t.destinationAccount):''}</td><td class="p-2 text-right font-semibold whitespace-nowrap ${t.type==='Income'?'text-emerald-600':'text-rose-600'}">${t.type==='Income'?'+':'−'}${money(t.amount)}</td><td class="p-2 whitespace-nowrap"><button class="text-emerald-600 hover:underline mr-2" onclick="app.closeModal();app.editTransaction('${String(t.id).replace(/'/g,'\\\'')}')">Edit</button><button class="text-rose-600 hover:underline" onclick="app.closeModal();app.deleteTransaction('${String(t.id).replace(/'/g,'\\\'')}')">Delete</button></td></tr>`).join('')||'<tr><td colspan="6" class="p-4 text-center text-slate-500">No matching entries for this period.</td></tr>'}</tbody></table></div>`;
                const total=kind==='accounts'?rows.reduce((a,x)=>a+num(x.balance),0):rows.reduce((a,x)=>a+num(x.amount),0);
                box.innerHTML=`<div class="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3"><div><h3 class="font-bold text-lg">${esc(title)}</h3><p class="text-xs text-slate-500 mt-1">${rows.length} ${kind==='accounts'?'account(s)':'entry/entries'} · Total ${money(total)}</p></div><button type="button" onclick="app.closeModal()" class="text-slate-500 hover:text-slate-900">✕</button></div>${table}<div class="flex justify-end"><button onclick="app.closeModal()" class="px-4 py-2 border rounded-xl">Close</button></div>`;
                document.getElementById('modal-container').classList.remove('hidden');
            }

            /**
             * Renders the  charts UI from the current app state.
             * Parameters: income, expense. Side effects, if any, are described by the statements below.
             */
            renderCharts(income, expense) {
                const num=v=>{if(typeof v==='string')v=v.replace(/[₹,\s]/g,'');const n=Number(v);return Number.isFinite(n)?n:0;};
                const assetTypes=['Receivable','Checking','Cash','Savings','Savings Account','Investment','Investment Account','Fixed Deposit','Fixed Deposit Account','Recurring Deposit','RD','RD Account'];
                const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-5+i);return {key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'})};});
                const monthTransactions=key=>this.countedTx().filter(t=>(this.parseLedgerDate(t.date)||'').startsWith(key));
                const incomeData=months.map(m=>monthTransactions(m.key).filter(t=>t.type==='Income').reduce((a,t)=>a+Math.max(0,num(t.amount)),0));
                const expenseData=months.map(m=>monthTransactions(m.key).filter(t=>['Expense','EMI','Installment'].includes(t.type)).reduce((a,t)=>a+Math.max(0,num(t.amount)),0));
                const ctxCf=document.getElementById('chart-cashflow').getContext('2d');if(this.charts.cf)this.charts.cf.destroy();
                this.charts.cf=new Chart(ctxCf,{type:'bar',data:{labels:months.map(m=>m.label),datasets:[{label:'Income',data:incomeData,backgroundColor:'#059669',borderRadius:6},{label:'Expenses / allocations',data:expenseData,backgroundColor:'#e11d48',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},onClick:(event,elements,chart)=>{if(!elements.length)return;const el=elements[0],month=months[el.index],type=el.datasetIndex===0?'Income':'Expense';this.openDashboardDrilldown(`${month.label} — ${type} Entries`,'month-type',{monthKey:month.key,type});}}});
                this.populateDashboardPieYearOptions();
                this.renderDashboardPieChart();
            }

            /**
             * Handles the populate dashboard pie year options workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            populateDashboardPieYearOptions() {
                const select=document.getElementById('dashboard-pie-year');
                if(!select) return;
                const current=select.value;
                const years=[...new Set((this.countedTx()||[]).map(t=>(this.parseLedgerDate(t.date)||'').slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort((a,b)=>b.localeCompare(a));
                const nowYear=String(new Date().getFullYear());
                if(!years.includes(nowYear)) years.unshift(nowYear);
                select.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
                select.value=years.includes(current)?current:nowYear;
            }

            /**
             * Renders the  dashboard pie chart UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderDashboardPieChart() {
                const canvas=document.getElementById('chart-categories');
                if(!canvas || typeof Chart==='undefined') return;
                const year=document.getElementById('dashboard-pie-year')?.value||String(new Date().getFullYear());
                const month=document.getElementById('dashboard-pie-month')?.value||'all';
                const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
                const period=month==='all'?`${year} — All months`:`${monthNames[Number(month)-1]} ${year}`;
                const label=document.getElementById('dashboard-pie-period-label');if(label)label.textContent=`Expenses by category · ${period}`;
                const num=v=>{if(typeof v==='string')v=v.replace(/[₹,\s]/g,'');const n=Number(v);return Number.isFinite(n)?n:0;};
                const catTotals={};
                this.countedTx().filter(t=>{
                    if(!['Expense','EMI','Installment'].includes(t.type))return false;
                    const d=this.parseLedgerDate(t.date)||'';
                    return d.slice(0,4)===year && (month==='all'||d.slice(5,7)===month);
                }).forEach(t=>{const cat=t.category||'Uncategorized';catTotals[cat]=(catTotals[cat]||0)+Math.max(0,num(t.amount));});
                if(this.charts.cat)this.charts.cat.destroy();
                const categories=Object.keys(catTotals);
                if(!categories.length){
                    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
                    this.charts.cat=new Chart(canvas.getContext('2d'),{type:'pie',data:{labels:['No expenses'],datasets:[{data:[1],backgroundColor:['#cbd5e1']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false},title:{display:true,text:'No expenses for this period'}}}});
                    return;
                }
                this.charts.cat=new Chart(canvas.getContext('2d'),{type:'pie',data:{labels:categories,datasets:[{data:categories.map(c=>catTotals[c]),backgroundColor:categories.map(c=>this.categoryColor(c)),borderWidth:1}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},onClick:(event,elements)=>{if(!elements.length)return;const category=categories[elements[0].index];if(category)this.openDashboardDrilldown(`${category} — ${period}`,'category-period',{category,year,month});}}});
            }

            // ---------- Stats: where the money went (or came from) in a month or a year ----------
            statsState(){ this.stats ||= {mode:'month',kind:'expense',key:this.todayISO().slice(0,7)}; return this.stats; }
            setStatsMode(mode){ const s=this.statsState(); if(mode===s.mode)return; s.key=mode==='year'?s.key.slice(0,4):(s.key.slice(0,4)===this.todayISO().slice(0,4)?this.todayISO().slice(0,7):`${s.key.slice(0,4)}-12`); s.mode=mode; this.renderStats(); }
            setStatsKind(kind){ this.statsState().kind=kind; this.renderStats(); }
            setStatsPeriod(key){ const s=this.statsState(); s.key=key==='now'?(s.mode==='year'?this.todayISO().slice(0,4):this.todayISO().slice(0,7)):key; this.renderStats(); }
            shiftStatsPeriod(step){ const s=this.statsState(); if(s.mode==='year'){ s.key=String(Number(s.key)+step); } else { const [y,m]=s.key.split('-').map(Number); s.key=this.todayISO(new Date(y,m-1+step,1)).slice(0,7); } this.renderStats(); }
            /** Category totals for the chosen period: [{category, amount, share, count}], largest first. Excluded entries are not counted. */
            statsRows(){
                const s=this.statsState(); const types=s.kind==='income'?['Income']:['Expense','EMI','Installment']; const by=new Map(); let total=0;
                this.countedTx().forEach(t=>{ if(!types.includes(t.type))return; const iso=this.normalizeLedgerDate(t.date); if(!iso.startsWith(s.key))return; const a=Math.max(0,Number(t.amount)||0); const c=t.category||'Uncategorized'; const o=by.get(c)||{category:c,amount:0,count:0}; o.amount+=a; o.count++; by.set(c,o); total+=a; });
                return {total,rows:[...by.values()].sort((a,b)=>b.amount-a.amount).map(o=>({...o,share:total?o.amount/total*100:0}))};
            }
            renderStats(){
                const panel=document.getElementById('panel-stats'); if(!panel||!this.data)return; const s=this.statsState();
                const label=document.getElementById('stats-period-label'); if(label)label.textContent=s.mode==='year'?s.key:this.monthLabel(s.key);
                panel.querySelectorAll('.st-mode [data-mode]').forEach(b=>{ const on=b.dataset.mode===s.mode; b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on)); });
                panel.querySelectorAll('.st-kind [data-kind]').forEach(b=>{ const on=b.dataset.kind===s.kind; b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on)); });
                const sumOf=kind=>{ const types=kind==='income'?['Income']:['Expense','EMI','Installment']; return this.countedTx().filter(t=>types.includes(t.type)&&this.normalizeLedgerDate(t.date).startsWith(s.key)).reduce((n,t)=>n+Math.max(0,Number(t.amount)||0),0); };
                const setText=(id,v)=>{ const el=document.getElementById(id); if(el)el.textContent=v; };
                setText('stats-total-expense',this.fmtMoney(sumOf('expense'))); setText('stats-total-income',this.fmtMoney(sumOf('income')));
                const {total,rows}=this.statsRows(); const period=s.mode==='year'?s.key:this.monthLabel(s.key,true);
                const center=document.getElementById('stats-center'); if(center)center.innerHTML=rows.length?`<span>${s.kind==='income'?'Income':'Spent'}</span><b>${this.fmtMoney0(total)}</b><small>${rows.length} categor${rows.length===1?'y':'ies'}</small>`:'';
                const list=document.getElementById('stats-list'); const esc=v=>this.escapeHtml(String(v??'')); const attrJs=v=>JSON.stringify(v).replace(/&/g,'&amp;').replace(/'/g,'&#39;');
                if(list)list.innerHTML=rows.length?rows.map(r=>`<button type="button" class="st-row" onclick='app.openLedgerCategory(${attrJs(r.category)},${attrJs(s.key)})' title="Show these entries in Core Ledger"><span class="st-pct" style="--c:${this.categoryColor(r.category)}">${r.share>=10?Math.round(r.share):r.share.toFixed(1)}%</span><span class="st-cat"><b>${esc(r.category)}</b><small>${r.count} entr${r.count===1?'y':'ies'}</small></span><span class="st-amt">${this.fmtMoney(r.amount)}</span></button>`).join(''):`<p class="lx-none">No ${s.kind==='income'?'income':'expenses'} in ${esc(period)}.</p>`;
                const canvas=document.getElementById('chart-stats'); if(!canvas||typeof Chart==='undefined')return;
                this.charts ||= {}; if(this.charts.stats)this.charts.stats.destroy();
                const dark=document.documentElement.classList.contains('dark');
                this.charts.stats=new Chart(canvas.getContext('2d'),{type:'doughnut',data:{labels:rows.length?rows.map(r=>r.category):['None'],datasets:[{data:rows.length?rows.map(r=>r.amount):[1],backgroundColor:rows.length?rows.map(r=>this.categoryColor(r.category)):[dark?'#334155':'#e2e8f0'],borderColor:dark?'#0f172a':'#fff',borderWidth:2}]},
                    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',animation:{duration:250},plugins:{legend:{display:false},tooltip:{enabled:!!rows.length,callbacks:{label:c=>` ${c.label}: ${this.fmtMoney(c.raw)} (${rows[c.dataIndex]?.share.toFixed(1)}%)`}}},
                    onClick:(e,els)=>{ if(!els.length||!rows.length)return; const r=rows[els[0].index]; if(r)this.openLedgerCategory(r.category,s.key); }}});
            }

        }
