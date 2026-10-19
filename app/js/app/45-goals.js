// AificoApp methods: goals (14 methods). Part of the AificoApp prototype chain.
        class AificoAppGoals extends AificoAppBudgets {
            /**
             * Renders the  goals UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderGoals() {
                const grid = document.getElementById('goals-grid');
                if(!grid)return;
                const money=v=>'₹'+(Number(v)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
                const goals=Array.isArray(this.data.goals)?this.data.goals:[];
                grid.innerHTML = goals.map(g => {
                    const target=Number(g.target)||0;
                    const current=this.getGoalCurrent(g);
                    const pct=target>0?Math.min(Math.round(current/target*100),100):0;
                    const cadence=g.cadence||'Once';
                    const contribution=Number(g.contribution)||0;
                    const freqLabel={monthly:'Monthly',quarterly:'Quarterly',weekly:'Weekly',yearly:'Yearly',once:'One-time'}[cadence.toLowerCase()]||cadence;
                    const due=this.getGoalNextDue(g);
                    const pending=Math.max(target-current,0);
                    const linked=this.data.accounts.find(a=>(g.accountId!==undefined&&g.accountId!==''&&String(a.id||a.name)===String(g.accountId))||(g.accountName&&String(a.name||'').trim().toLowerCase()===String(g.accountName).trim().toLowerCase()));
                    return `<div class="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div class="flex justify-between items-start gap-2"><div><h4 class="font-bold text-sm">${this.escapeHtml(g.title||'Savings Goal')}</h4><p class="text-xs text-slate-500 mt-1">Target: ${this.escapeHtml(g.deadline||'Not set')}</p></div><div class="flex gap-2"><button onclick="app.openGoalModal('${String(g.id).replace(/'/g,"\\'")}')" class="text-xs text-blue-600 hover:underline">Edit</button><button onclick="app.openGoalModal('${String(g.id).replace(/'/g,"\\'")}')" class="text-xs text-emerald-600 hover:underline">Link account</button><button onclick="app.deleteGoal('${String(g.id).replace(/'/g,"\\'")}')" class="text-xs text-rose-600 hover:underline">Delete</button></div></div>
                        <div class="text-2xl font-bold">${money(current)} <span class="text-xs font-normal text-slate-500">/ ${money(target)}</span></div>
                        <div class="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden"><div class="bg-emerald-600 h-2.5 rounded-full" style="width:${pct}%"></div></div>
                        <div class="grid grid-cols-2 gap-2 text-xs"><div><span class="text-slate-500">Pending to goal</span><p class="font-semibold">${money(pending)}</p></div><div><span class="text-slate-500">Progress</span><p class="font-semibold">${pct}%</p></div></div>
                        <div class="text-xs text-slate-500 space-y-1"><p>Linked account: <strong>${this.escapeHtml(linked?.name||g.accountName||'Not linked')}</strong></p><p>Contribution: <strong>${contribution>0?money(contribution)+' / '+this.escapeHtml(freqLabel):'Not scheduled'}</strong></p>${due?`<p>Next contribution: <strong>${this.escapeHtml(due)}</strong></p>`:''}</div>
                        ${this.goalPlanSummary(g)}
                    </div>`;
                }).join('') || '<p class="col-span-full text-sm text-slate-500 py-8 text-center">No savings goals yet. Add a goal to start tracking progress.</p>';
            }
            // ---------- Goal Planner: what a future purchase will cost, how much to save, and where the money can come from ----------
            /**
             * Handles the planner types workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            plannerTypes(){ return {
                house:{label:'House',icon:'home',inflation:7,years:5,loan:true,dp:20,loanRate:8.5,loanYears:20},
                vehicle:{label:'Vehicle',icon:'car',inflation:5,years:2,loan:false,dp:20,loanRate:9,loanYears:5},
                land:{label:'Land / plot',icon:'map',inflation:8,years:5,loan:false,dp:30,loanRate:9.5,loanYears:15},
                education:{label:'Education',icon:'graduation-cap',inflation:10,years:10,loan:false,dp:20,loanRate:10,loanYears:7},
                wedding:{label:'Wedding',icon:'heart',inflation:7,years:5,loan:false,dp:100,loanRate:12,loanYears:5},
                other:{label:'Other',icon:'target',inflation:6,years:3,loan:false,dp:100,loanRate:10,loanYears:5}}; }
            // Average monthly income and spending over the last full months that have data (up to 3), by category.
            /**
             * Handles the analyse spending workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: maxMonths=3. Side effects, if any, are described by the statements below.
             */
            analyseSpending(maxMonths=3){
                const now=new Date(); const months=[];
                for(let k=1;k<=12&&months.length<maxMonths;k++){ const d=new Date(now.getFullYear(),now.getMonth()-k,1); const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                    const has=(this.data.tx||[]).some(t=>!t.excludedFromLedger&&(this.parseLedgerDate(t.date)||'').startsWith(key)); if(has)months.push(key); }
                const set=new Set(months); let income=0, spend=0; const cats=new Map();
                for(const t of (this.data.tx||[])){ if(t.excludedFromLedger)continue; const m=(this.parseLedgerDate(t.date)||'').slice(0,7); if(!set.has(m))continue; const a=Math.abs(Number(t.amount)||0);
                    if(t.type==='Income')income+=a; else if(['Expense','EMI','Installment'].includes(t.type)){ spend+=a; const c=t.category||'Uncategorized'; cats.set(c,(cats.get(c)||0)+a); } }
                const n=Math.max(1,months.length); const flex=/dining|restaurant|food & dining|eating|shopping|entertainment|movie|travel|holiday|vacation|subscription|ott|personal|gift|outing|leisure|hobby|gadget|electronics|clothing|fashion|beauty/i;
                const categories=[...cats].map(([name,total])=>({name,avg:total/n,flexible:flex.test(name)})).sort((a,b)=>b.avg-a.avg);
                return {months,count:months.length,income:income/n,spend:spend/n,surplus:(income-spend)/n,categories,flexible:categories.filter(c=>c.flexible).reduce((s,c)=>s+c.avg,0)};
            }
            // Core maths. Inputs are the user's own assumptions; nothing here is a guarantee.
            /**
             * Handles the plan calc workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: p. Side effects, if any, are described by the statements below.
             */
            planCalc(p){
                const cost=Math.max(0,Number(p.cost)||0), years=Math.max(0,Number(p.years)||0), months=Math.round(years*12), inf=(Number(p.inflation)||0)/100, r=(Number(p.returnRate)||0)/100, i=r/12, step=(Number(p.stepUp)||0)/100, saved=Math.max(0,Number(p.saved)||0);
                if(!cost||!months)return null;
                const futureCost=cost*Math.pow(1+inf,years);
                const useLoan=!!p.useLoan&&Number(p.dp)<100; const dpPct=useLoan?Math.min(100,Math.max(0,Number(p.dp)||0)):100;
                const saveTarget=futureCost*dpPct/100;
                const savedFuture=saved*Math.pow(1+i,months);
                const gap=Math.max(0,saveTarget-savedFuture);
                let fv1=0; for(let m=1;m<=months;m++){ fv1=fv1*(1+i)+Math.pow(1+step,Math.floor((m-1)/12)); }
                const monthly=gap>0?gap/fv1:0;
                let loan=null;
                if(useLoan){ const L=futureCost-saveTarget, n=Math.round((Number(p.loanYears)||0)*12), li=(Number(p.loanRate)||0)/1200; const emi=n?(li?L*li*Math.pow(1+li,n)/(Math.pow(1+li,n)-1):L/n):0; loan={amount:L,emi,months:n,totalInterest:Math.max(0,emi*n-L)}; }
                const target=new Date(); target.setMonth(target.getMonth()+months);
                return {futureCost,saveTarget,savedFuture,gap,monthly,loan,months,targetDate:target.toISOString().slice(0,10)};
            }
            // How many months it would take at a given monthly saving (cost keeps rising with inflation meanwhile).
            /**
             * Handles the plan months at workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: p,perMonth. Side effects, if any, are described by the statements below.
             */
            planMonthsAt(p,perMonth){
                const cost=Number(p.cost)||0, inf=(Number(p.inflation)||0)/100, i=(Number(p.returnRate)||0)/1200, saved=Number(p.saved)||0, dpPct=(p.useLoan&&Number(p.dp)<100)?Number(p.dp)/100:1;
                if(perMonth<=0&&saved<=0)return null; let bal=saved;
                for(let m=1;m<=600;m++){ bal=bal*(1+i)+perMonth; if(bal>=cost*dpPct*Math.pow(1+inf,m/12))return m; }
                return null;
            }
            /**
             * Opens the  goal planner screen, dialog, or workflow.
             * Parameters: goalId. Side effects, if any, are described by the statements below.
             */
            openGoalPlanner(goalId){
                const esc=v=>this.escapeHtml(String(v??'')); const types=this.plannerTypes();
                const g=goalId?(this.data.goals||[]).find(x=>String(x.id)===String(goalId)):null;
                const t0=g?.plan?.type||'house'; const d=types[t0];
                const p=g?.plan?{...g.plan}:{type:t0,name:'',cost:'',years:d.years,inflation:d.inflation,saved:'',returnRate:7,stepUp:0,useLoan:d.loan,dp:d.dp,loanRate:d.loanRate,loanYears:d.loanYears};
                const f=(name,label,attrs='',hint='')=>`<label class="ip-field"><span>${label}</span><input name="${name}" value="${esc(p[name])}" ${attrs}>${hint?`<small class="gp-hint">${hint}</small>`:''}</label>`;
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3"><h3 class="font-bold text-lg">${g?'Edit plan':'Plan a big purchase'}</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                <form id="gp-form" class="ip-form" novalidate>
                  <div class="gp-types">${Object.entries(types).map(([k,v])=>`<label class="gp-type"><input type="radio" name="type" value="${k}" ${p.type===k?'checked':''}><span><i data-lucide="${v.icon}"></i>${v.label}</span></label>`).join('')}</div>
                  ${f('name','Name this goal','type="text" maxlength="60" placeholder="e.g. 2BHK flat in Pune"')}
                  <div class="ip-two">${f('cost','Cost today (₹)','type="number" min="1" step="1000" inputmode="numeric" required placeholder="e.g. 6500000"')}${f('years','Tenure (Yr)','type="number" min="0.5" max="40" step="0.5" inputmode="decimal" required')}</div>
                  <div class="ip-two">${f('inflation','Price rise % Yr','type="number" min="0" max="25" step="0.5" inputmode="decimal"','How fast this kind of cost grows')}${f('saved','Saved (₹)','type="number" min="0" step="1000" inputmode="numeric" placeholder="e.g. 300000"')}</div>
                  <div class="ip-two">${f('returnRate','Return % Yr','type="number" min="0" max="20" step="0.5" inputmode="decimal"','Your assumption, e.g. FD/RD rates')}${f('stepUp','Raise savings % Yr','type="number" min="0" max="30" step="1" inputmode="numeric"','0 = same amount every month')}</div>
                  <fieldset class="ip-fieldset" id="gp-loan"><legend><label><input type="checkbox" name="useLoan" ${p.useLoan?'checked':''}> Use a loan for part of it</label></legend>
                    <div class="ip-two">${f('dp','Down payment %','type="number" min="0" max="100" step="5" inputmode="numeric"')}${f('loanRate','Rate % Yr','type="number" min="0" max="30" step="0.1" inputmode="decimal"')}</div>
                    ${f('loanYears','Loan tenure (Yr)','type="number" min="1" max="30" step="1" inputmode="numeric"')}
                  </fieldset>
                  <div id="gp-result" aria-live="polite"></div>
                  <div class="ip-form-actions"><button type="button" class="s-btn s-secondary" onclick="app.closeModal()">Cancel</button><button type="submit" class="s-btn s-primary">${g?'Save changes':'Save as goal'}</button></div>
                </form>`;
                document.getElementById('modal-container').classList.remove('hidden'); window.lucide?.createIcons?.();
                const form=document.getElementById('gp-form');
                const read=()=>{const o={}; new FormData(form).forEach((v,k)=>{o[k]=typeof v==='string'?v.trim():v;}); o.useLoan=!!form.querySelector('[name=useLoan]').checked; return o;};
                form.querySelectorAll('[name=type]').forEach(r=>r.addEventListener('change',()=>{ const d=types[r.value]; const set=(k,v)=>{const e=form.querySelector(`[name=${k}]`); if(e)e.value=v;}; set('inflation',d.inflation); set('years',d.years); set('dp',d.dp); set('loanRate',d.loanRate); set('loanYears',d.loanYears); form.querySelector('[name=useLoan]').checked=d.loan; update(); }));
                const update=()=>{ document.getElementById('gp-result').innerHTML=this.goalPlanReport(read()); };
                form.addEventListener('input',update); update();
                form.addEventListener('submit',e=>{ e.preventDefault(); const o=read(); const c=this.planCalc(o); if(!c)return alert('Enter the cost and how many years away it is.');
                    const name=o.name||`${types[o.type]?.label||'Goal'} plan`;
                    const fields={title:name,target:Math.round(c.saveTarget),deadline:c.targetDate,cadence:'monthly',contribution:Math.ceil(c.monthly/100)*100,plan:{...o,savedAt:new Date().toISOString().slice(0,10)}};
                    if(g){ Object.assign(g,fields); } else { const next=new Date(); next.setMonth(next.getMonth()+1,1); this.data.goals ||= []; this.data.goals.push({id:'goal_'+Date.now(),...fields,current:Number(o.saved)||0,nextDue:next.toISOString().slice(0,10),accountId:'',accountName:'',createdAt:new Date().toISOString().slice(0,10)}); }
                    this.saveVault(); this.closeModal(); this.renderAll(); });
            }
            /**
             * Handles the goal plan report workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: p. Side effects, if any, are described by the statements below.
             */
            goalPlanReport(p){
                const c=this.planCalc(p); const m=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN'); const esc=v=>this.escapeHtml(String(v??''));
                if(!c)return '<p class="gp-hint">Enter the cost and how many years away it is to see your plan.</p>';
                const a=this.analyseSpending(3); const otherGoals=(this.data.goals||[]).filter(g=>g.plan&&g.title!==p.name).reduce((s,g)=>s+(Number(g.contribution)||0),0);
                const free=a.surplus-otherGoals; const need=c.monthly;
                let verdict, cls;
                if(!a.count){ verdict='Add a few months of income and expenses in Core Ledger to compare this plan with your actual spending.'; cls='gp-neutral'; }
                else if(need<=0){ verdict='What you have already saved is expected to cover this. No monthly saving is needed.'; cls='gp-ok'; }
                else if(free>=need*1.2){ verdict=`Comfortable: your average surplus after other planned goals (${m(free)}/month) covers this with room to spare.`; cls='gp-ok'; }
                else if(free>=need){ verdict=`Tight: it fits within your average surplus of ${m(free)}/month, with little left over.`; cls='gp-warn'; }
                else { verdict=`Short by ${m(need-Math.max(0,free))}/month compared with your average surplus of ${m(Math.max(0,free))}/month.`; cls='gp-bad'; }
                const ways=[];
                if(a.count&&need>Math.max(0,free)){
                    const extra=need-Math.max(0,free);
                    if(a.flexible>0){ const pct=Math.ceil(extra/a.flexible*100); ways.push(pct<=60?`Trim flexible spending (${a.categories.filter(x=>x.flexible).slice(0,3).map(x=>esc(x.name)).join(', ')}) by about <b>${pct}%</b> to free ${m(extra)}/month.`:`Flexible spending is ${m(a.flexible)}/month in total, so trimming it alone won't close the gap.`); }
                    const months=this.planMonthsAt(p,Math.max(0,free)); if(months&&free>0)ways.push(`At your current surplus you'd reach it in about <b>${(months/12).toFixed(1)} years</b> instead of ${esc(p.years)}.`); else if(free<=0)ways.push('Your spending currently matches or exceeds your income, so start by freeing up a monthly surplus.');
                    if(!(p.useLoan&&Number(p.dp)<100)&&['house','vehicle','land','education'].includes(p.type))ways.push('Funding part of it with a loan lowers what you need to save now; tick "Use a loan" to compare.');
                    if(!(Number(p.stepUp)>0))ways.push('Raising your saving by 5–10% each year as income grows lowers the starting amount; try the "Raise saving each year" field.');
                }
                const cats=a.categories.slice(0,6).map(x=>`<li><span>${esc(x.name)}${x.flexible?' <em class="gp-flex">flexible</em>':''}</span><b>${m(x.avg)}</b></li>`).join('');
                return `<div class="gp-res">
                  <div class="ip-preview"><div><span>Cost in ${new Date(c.targetDate).getFullYear()}</span><b>${m(c.futureCost)}</b></div><div><span>${c.loan?'Down payment to save':'Amount to save'}</span><b>${m(c.saveTarget)}</b></div><div><span>Save each month${Number(p.stepUp)>0?' (first year)':''}</span><b class="gp-big">${m(need)}</b></div><div><span>Your savings will grow to</span><b>${m(c.savedFuture)}</b></div>${c.loan?`<div><span>Loan needed</span><b>${m(c.loan.amount)}</b></div><div><span>EMI after purchase</span><b>${m(c.loan.emi)} × ${c.loan.months}</b></div>`:''}</div>
                  <p class="gp-verdict ${cls}">${verdict}</p>
                  ${c.loan&&a.income>0?`<p class="gp-hint">That EMI would be about ${Math.round(c.loan.emi/a.income*100)}% of your current average monthly income. Total loan interest: ${m(c.loan.totalInterest)}.${c.loan.emi/a.income>0.5?' Lenders usually look for total EMIs to stay under roughly 40–50% of income, so a larger down payment or longer tenure may be needed.':''}</p>`:''}
                  ${ways.length?`<div class="gp-ways"><b>Ways to close the gap</b><ul>${ways.map(w=>`<li>${w}</li>`).join('')}</ul></div>`:''}
                  ${a.count?`<details class="gp-spend"><summary>Your spending · average of ${a.count} month${a.count>1?'s':''}</summary><div class="gp-row"><span>Income</span><b class="ip-pos">${m(a.income)}</b></div><div class="gp-row"><span>Spending</span><b class="ip-neg">${m(a.spend)}</b></div><div class="gp-row"><span>Surplus</span><b>${m(a.surplus)}</b></div>${otherGoals?`<div class="gp-row"><span>Already planned for other goals</span><b>${m(otherGoals)}</b></div>`:''}<ul class="gp-cats">${cats}</ul></details>`:''}
                  <p class="gp-hint">Estimates from your own assumptions. Prices and returns can differ, so revisit the plan once or twice a year. This is not financial advice.</p></div>`;
            }
            /**
             * Handles the goal plan summary workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: g. Side effects, if any, are described by the statements below.
             */
            goalPlanSummary(g){
                if(!g||!g.plan)return '';
                const c=this.planCalc(g.plan); if(!c)return ''; const m=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN'); const t=this.plannerTypes()[g.plan.type]||{label:'Plan'};
                return `<div class="gp-card"><div><span>${this.escapeHtml(t.label)} plan</span><b>${m(g.plan.cost)} today → ${m(c.futureCost)} in ${new Date(c.targetDate).getFullYear()}</b>${c.loan?`<small>Save ${m(c.saveTarget)} down payment · loan ${m(c.loan.amount)}</small>`:''}</div><button type="button" class="s-btn s-secondary" data-id="${this.escapeHtml(String(g.id))}" onclick="app.openGoalPlanner(this.dataset.id)">Open plan</button></div>`;
            }
            /**
             * Returns or checks  goal current.
             * Parameters: g. Side effects, if any, are described by the statements below.
             */
            getGoalCurrent(g){
                const linked=this.data.accounts.find(a=>(g.accountId!==undefined&&g.accountId!==''&&String(a.id||a.name)===String(g.accountId))||(g.accountName&&String(a.name||'').trim().toLowerCase()===String(g.accountName).trim().toLowerCase()));
                if(linked && g.linkAccountBalance!==false) return Math.max(Number(linked.balance)||0,0);
                return Math.max(Number(g.current)||0,0);
            }
            /**
             * Returns or checks  goal next due.
             * Parameters: g. Side effects, if any, are described by the statements below.
             */
            getGoalNextDue(g){
                const amount=Number(g.contribution)||0;if(!amount)return '';
                const now=new Date();let d=g.nextDue?new Date(g.nextDue+'T12:00:00'):new Date(g.createdAt||now);
                if(Number.isNaN(d.getTime()))d=new Date(now);
                const cadence=(g.cadence||'monthly').toLowerCase();
                let guard=0;
                while(d<new Date(now.getFullYear(),now.getMonth(),now.getDate())&&guard++<500){
                    if(cadence==='weekly')d.setDate(d.getDate()+7);
                    else if(cadence==='quarterly')d.setMonth(d.getMonth()+3);
                    else if(cadence==='yearly')d.setFullYear(d.getFullYear()+1);
                    else if(cadence==='monthly')d.setMonth(d.getMonth()+1);
                    else return '';
                }
                return d.toISOString().slice(0,10);
            }
            /**
             * Opens the  goal modal advanced screen, dialog, or workflow.
             * Parameters: id=null. Side effects, if any, are described by the statements below.
             */
            openGoalModalAdvanced(id=null){
                const existing=id?this.data.goals.find(g=>String(g.id)===String(id)):null;
                const g=existing||{title:'',target:'',current:0,deadline:'',cadence:'monthly',contribution:0,accountId:'',linkAccountBalance:true};
                const accounts=this.data.accounts||[];
                const opts=accounts.map((a)=>{const key=String(a.id||a.name||'');return `<option value="${this.escapeHtml(key)}" ${(String(g.accountId||'')===key||(g.accountName&&String(g.accountName).trim().toLowerCase()===String(a.name||'').trim().toLowerCase()))?'selected':''}>${this.escapeHtml(a.name||'Unnamed account')} (${this.escapeHtml(a.type||'Account')})</option>`;}).join('');
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex items-center justify-between border-b pb-3"><h3 class="font-bold text-lg">${existing?'Edit Savings Goal':'Add Savings Goal'}</h3><button type="button" onclick="app.closeModal()">✕</button></div>
                <form onsubmit="app.saveGoalForm(event,${existing?`'${String(g.id).replace(/'/g,"\\'")}'`:'null'})" class="space-y-3">
                  <label class="block text-sm">Goal name<input id="goal-title" required maxlength="100" value="${this.escapeHtml(g.title||'')}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label>
                  <div class="grid grid-cols-2 gap-3"><label class="block text-sm">Target amount (₹)<input id="goal-target" type="number" min="0.01" step="0.01" required value="${Number(g.target)||''}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><button type="button" onclick="app.openAmountCalculator('goal-target')" class="mt-1 text-xs text-emerald-600 hover:underline">🧮 Calculator</button></label><label class="block text-sm">Target date<input id="goal-deadline" type="date" value="${this.escapeHtml(g.deadline||'')}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label></div>
                  <label class="block text-sm">Linked savings / investment account<select id="goal-account" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><option value="">No linked account</option>${opts}</select></label>${accounts.length===0?'<p class="text-xs text-rose-600">No accounts exist yet. Create a savings account in Accounts & Wallets first, then edit this goal to link it.</p>':''}
                  <p class="text-xs text-slate-500">When linked, goal progress is based on that account's current balance. Keep each account linked to only one goal if you want to avoid counting the same savings twice.</p>
                  <div class="grid grid-cols-2 gap-3"><label class="block text-sm">Contribution frequency<select id="goal-cadence" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800">${['once','weekly','monthly','quarterly','yearly'].map(c=>`<option value="${c}" ${(g.cadence||'monthly')===c?'selected':''}>${({once:'One-time',weekly:'Weekly',monthly:'Monthly',quarterly:'Quarterly',yearly:'Yearly'})[c]}</option>`).join('')}</select></label><label class="block text-sm">Contribution amount (₹)<input id="goal-contribution" type="number" min="0" step="0.01" value="${Number(g.contribution)||0}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><button type="button" onclick="app.openAmountCalculator('goal-contribution')" class="mt-1 text-xs text-emerald-600 hover:underline">🧮 Calculator</button></label></div>
                  <label class="block text-sm">Next contribution date<input id="goal-nextdue" type="date" value="${this.escapeHtml(g.nextDue||'')}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label>
                  <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-lg">Save goal</button></div>
                </form>`;
                document.getElementById('modal-container').classList.remove('hidden');
            }
            /**
             * Validates and saves  goal form.
             * Parameters: event,id. Side effects, if any, are described by the statements below.
             */
            saveGoalForm(event,id){
                event.preventDefault();
                const title=document.getElementById('goal-title').value.trim(),target=Number(document.getElementById('goal-target').value),accountId=document.getElementById('goal-account').value;
                const contribution=Number(document.getElementById('goal-contribution').value)||0;
                if(!title||!Number.isFinite(target)||target<=0||contribution<0)return alert('Enter a goal name, valid target, and non-negative contribution.');
                const account=this.data.accounts.find(a=>String(a.id||a.name)===String(accountId)||String(a.name)===String(accountId));
                const fields={title,target,deadline:document.getElementById('goal-deadline').value,cadence:document.getElementById('goal-cadence').value,contribution,nextDue:document.getElementById('goal-nextdue').value,accountId:account?String(account.id||account.name):'',accountName:account?account.name:'',linkAccountBalance:true};
                if(id){const g=this.data.goals.find(x=>String(x.id)===String(id));if(g)Object.assign(g,fields);}
                else this.data.goals.push({id:'goal_'+Date.now(),...fields,current:0,createdAt:new Date().toISOString().slice(0,10)});
                this.saveVault();this.renderAll();this.closeModal();
            }
            /**
             * Removes goal, including associated cleanup where applicable.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async deleteGoal(id){
                const g=this.data.goals.find(x=>String(x.id)===String(id));if(!g)return;
                if(!await this.uiConfirm(`Delete goal "${g.title}"? This removes only the goal definition, not its linked account or ledger transactions. You can recreate it later.`))return;
                this.data.goals=this.data.goals.filter(x=>String(x.id)!==String(id));this.saveVault();this.renderAll();
            }
            /**
             * Opens the  goal modal screen, dialog, or workflow.
             * Parameters: id=null. Side effects, if any, are described by the statements below.
             */
            openGoalModal(id=null) { return this.openGoalModalAdvanced(id); }
        }
