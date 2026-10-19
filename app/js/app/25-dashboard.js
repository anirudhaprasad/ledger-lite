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
                const assetTypesForFlow = ['Checking','Cash','Savings','Savings Account','Investment','Investment Account','Fixed Deposit','Fixed Deposit Account','Recurring Deposit','RD','RD Account'];
                const income = this.countedTx().filter(t => t.type === 'Income' && inMonth(t)).reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                const expense = this.countedTx().filter(t => (['Expense','EMI','Installment'].includes(t.type) || (t.type==='Transfer' && assetTypesForFlow.includes((this.data.accounts.find(a=>a.name===(t.destinationAccount||t.toAccount))||{}).type))) && inMonth(t)).reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                const suspiciousAccounts = this.data.accounts.filter(a => !Number.isFinite(Number(a.balance)) || Math.abs(num(a.balance)) >= 1000000000);
                const suspiciousTx = this.data.tx.filter(t => !Number.isFinite(Number(t.amount)) || Math.abs(num(t.amount)) >= 1000000000);
                let warning = document.getElementById('dashboard-calculation-warning');
                if (!warning) { warning=document.createElement('div'); warning.id='dashboard-calculation-warning'; warning.className='mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900'; document.querySelector('#panel-dashboard')?.prepend(warning); }
                const moneyDashboard = v => `₹${num(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                warning.classList.toggle('hidden', !(suspiciousAccounts.length || suspiciousTx.length));
                if (suspiciousAccounts.length || suspiciousTx.length) {
                    const accountDetails = suspiciousAccounts.map(a => `<li><strong>${this.escapeHtml(a.name||'Unnamed account')}</strong> (${this.escapeHtml(a.type||'Unknown type')}): ${moneyDashboard(a.balance)}</li>`).join('');
                    const txDetails = suspiciousTx.slice(0,8).map(t => `<li>${this.escapeHtml(t.date||'No date')} · ${this.escapeHtml(t.payee||t.description||t.notes||'Transaction')} · ${moneyDashboard(t.amount)}</li>`).join('');
                    const accountActions = suspiciousAccounts.map((a, accountIndex) => `<li class="mb-2"><strong>${this.escapeHtml(a.name||'Unnamed account')}</strong> (${this.escapeHtml(a.type||'Unknown type')}): ${moneyDashboard(a.balance)} <button type="button" class="ml-2 underline font-semibold" onclick="app.rebuildAccountBalanceFromLedgerByIndex(${this.data.accounts.indexOf(a)})">Rebuild from ledger</button> <button type="button" class="ml-2 underline" onclick="app.reconcileAccountBalanceByIndex(${this.data.accounts.indexOf(a)})">Set verified balance</button> <button type="button" class="ml-2 underline" onclick="app.openAccountLedgerEntriesByIndex(${this.data.accounts.indexOf(a)})">Inspect ledger entries</button></li>`).join('');
                    warning.innerHTML = `<div class="font-semibold mb-1">Dashboard totals need review</div><p class="mb-2">Found ${suspiciousAccounts.length} account balance(s) and ${suspiciousTx.length} transaction amount(s) that are invalid or unusually large (₹1 billion or more). No data has been changed automatically.</p>${accountActions?`<div class="font-semibold">Accounts to check</div><ul class="list-disc pl-5 mb-2">${accountActions}</ul>`:''}${txDetails?`<div class="font-semibold">Example transactions to check</div><ul class="list-disc pl-5 mb-2">${txDetails}</ul>`:''}<p class="text-xs mb-2">Use “Set verified balance” only after checking your actual bank statement. This changes the account's stored balance; it does not delete or rewrite ledger history.</p><button type="button" class="underline font-semibold" onclick="app.openDashboardDrilldown('Account balances to review','accounts-networth')">Open account breakdown</button>`;
                }
                const netEl=document.getElementById('kpi-net-worth'), liquidEl=document.getElementById('kpi-liquid');
                netEl.innerText = suspiciousAccounts.length ? 'Review data' : moneyDashboard(netWorth);
                liquidEl.innerText = suspiciousAccounts.some(a=>['Checking','Cash','Savings','Savings Account'].includes(a.type)) ? 'Review data' : moneyDashboard(liquid);
                document.getElementById('kpi-income').innerText = `₹${income.toLocaleString('en-IN', {minimumFractionDigits: 2,maximumFractionDigits:2})}`;
                document.getElementById('kpi-expense').innerText = `₹${expense.toLocaleString('en-IN', {minimumFractionDigits: 2,maximumFractionDigits:2})}`;
                this.renderMonthlyComparison();
                const tbody = document.getElementById('dashboard-tx-tbody');
                tbody.innerHTML = this.countedTx().slice(0,5).map(t => `<tr title="Open transaction details" class="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onclick="app.editTransaction('${String(t.id).replace(/'/g, '\\\'')}')"><td class="py-3 text-slate-500">${this.escapeHtml(t.date||'')}</td><td class="py-3 font-medium">${this.escapeHtml(t.payee||t.description||'')}</td><td class="py-3"><span class="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800">${this.escapeHtml(t.category||'Uncategorized')}</span></td><td class="py-3 text-slate-500">${this.escapeHtml(t.account||'')}</td><td class="py-3 text-right font-semibold ${t.type==='Income'?'text-emerald-600':'text-slate-800 dark:text-slate-200'}">${t.type==='Income'?'+':'-'}₹${num(t.amount).toLocaleString('en-IN')}</td></tr>`).join('');
                const remList = document.getElementById('reminders-list');
                const scheduledItems = (Array.isArray(this.data.yearly)?this.data.yearly:[]).filter(y=>y.enabled!==false);
                remList.innerHTML = scheduledItems.map(y => {
                    const due = y.startDate || y.dueDate || 'Not set';
                    const mode = y.destinationType || (y.sourceAccount && y.destinationAccount ? 'account' : 'legacy');
                    let destination = '';
                    if (mode === 'account') destination = `To account: ${this.escapeHtml(y.destinationAccountName || y.destinationAccount || 'Destination account')}`;
                    else if (mode === 'category') destination = `Category: ${this.escapeHtml(y.category || 'Uncategorized')}${y.subcategory ? ' / '+this.escapeHtml(y.subcategory) : ''} · ${this.escapeHtml(y.transactionType || 'Expense')}`;
                    else destination = 'Legacy schedule · Edit in Yearly / Scheduled to configure destination';
                    const source = y.sourceAccountName ? `From: ${this.escapeHtml(y.sourceAccountName)} · ` : '';
                    const frequency = y.frequency ? `${this.escapeHtml(y.frequency.charAt(0).toUpperCase()+y.frequency.slice(1))} · ` : '';
                    const status = mode === 'legacy' ? 'Needs setup' : 'Scheduled';
                    return `<div class="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800"><div class="min-w-0"><h4 class="font-medium text-sm">${this.escapeHtml(y.title||'')}</h4><p class="text-xs text-slate-500">Due: ${this.escapeHtml(due)} · ${frequency}${source}${destination}</p><p class="text-xs ${mode==='legacy'?'text-amber-600':'text-emerald-600'} mt-1">${status}</p></div><span class="font-bold text-sm shrink-0">₹${num(y.amount).toLocaleString('en-IN')}</span></div>`;
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
                const label = d => d.toLocaleDateString('en-IN',{month:'short',year:'numeric'});
                const flowExpense = t => ['Expense','EMI','Installment'].includes(t.type) || (t.type==='Transfer' && ['Checking','Cash','Savings','Savings Account','Investment','Investment Account','Fixed Deposit','Fixed Deposit Account','Recurring Deposit','RD','RD Account'].includes((this.data.accounts.find(a=>a.name===(t.destinationAccount||t.toAccount))||{}).type));
                const totals = monthKey => {
                    const rows=this.countedTx().filter(t=>(this.parseLedgerDate(t.date)||'').slice(0,7)===monthKey);
                    const income=rows.filter(t=>t.type==='Income').reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                    const expense=rows.filter(flowExpense).reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                    return {income,expense,net:income-expense};
                };
                const cur=totals(key(current)), prev=totals(key(previous));
                const money=v=>`₹${v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                const change=(a,b)=>{const diff=a-b;const pct=b===0?(a===0?'0.0%':'—'):`${Math.abs(diff/b*100).toFixed(1)}%`;return `${diff>0?'+':diff<0?'−':''}${money(Math.abs(diff))} (${diff>0?'+':diff<0?'−':''}${pct}) vs ${label(previous)}`;};
                const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
                set('dashboard-comparison-period',`${label(current)} vs ${label(previous)}`);
                set('comparison-current-income',money(cur.income)); set('comparison-current-expense',money(cur.expense)); set('comparison-current-net',money(cur.net));
                set('comparison-income-change',change(cur.income,prev.income)); set('comparison-expense-change',change(cur.expense,prev.expense)); set('comparison-net-change',change(cur.net,prev.net));
                const netEl=document.getElementById('comparison-current-net'); if(netEl)netEl.className=`text-lg font-bold mt-1 ${cur.net>=0?'text-emerald-600':'text-rose-600'}`;
            }

            /**
             * Opens the  dashboard drilldown screen, dialog, or workflow.
             * Parameters: title, mode, extra={}. Side effects, if any, are described by the statements below.
             */
            openDashboardDrilldown(title, mode, extra={}) {
                const num=v=>{if(typeof v==='string')v=v.replace(/[₹,\s]/g,'');const n=Number(v);return Number.isFinite(n)?n:0;};
                const money=v=>`₹${Math.abs(num(v)).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
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
                        if(mode==='expense-current')return inMonth(t)&&(['Expense','EMI','Installment'].includes(t.type)||(t.type==='Transfer'&&assetTypes.includes((this.data.accounts.find(a=>a.name===(t.destinationAccount||t.toAccount))||{}).type)));
                        if(mode==='month-type')return (this.parseLedgerDate(t.date)||'').slice(0,7)===extra.monthKey && (extra.type==='Income'?t.type==='Income':(['Expense','EMI','Installment'].includes(t.type)||(t.type==='Transfer'&&assetTypes.includes((this.data.accounts.find(a=>a.name===(t.destinationAccount||t.toAccount))||{}).type))));
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
                const expenseData=months.map(m=>monthTransactions(m.key).filter(t=>['Expense','EMI','Installment'].includes(t.type)||(t.type==='Transfer'&&assetTypes.includes((this.data.accounts.find(a=>a.name===(t.destinationAccount||t.toAccount))||{}).type))).reduce((a,t)=>a+Math.max(0,num(t.amount)),0));
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
                this.charts.cat=new Chart(canvas.getContext('2d'),{type:'pie',data:{labels:categories,datasets:[{data:categories.map(c=>catTotals[c])}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},onClick:(event,elements)=>{if(!elements.length)return;const category=categories[elements[0].index];if(category)this.openDashboardDrilldown(`${category} — ${period}`,'category-period',{category,year,month});}}});
            }

        }
