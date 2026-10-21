
        // Apply the saved light/dark choice before anything renders.
        try { const theme = localStorage.getItem('aifico-theme'); if (theme) document.documentElement.classList.toggle('dark', theme === 'dark'); } catch (e) {}
        const app = new AificoApp();
        // Android back button (called by the native wrapper): close whatever is open first, then go to the
        // Dashboard, and only leave the app from there. Returns true when it handled the press.
        window.aificoHandleBack = () => {
            const open = () => !document.getElementById('modal-container')?.classList.contains('hidden') || document.getElementById('aifico-alert-overlay')?.style.display === 'flex' || !!document.querySelector('#aifico-dialog-x, #aifico-prompt-x, #restore-preview-x');
            if (open()) {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                if (!document.getElementById('modal-container')?.classList.contains('hidden')) app.closeModal();
                return true;
            }
            const calc = document.getElementById('aifico-calculator-overlay'); if (calc) { calc.remove(); return true; }
            if (document.getElementById('app-sidebar')?.classList.contains('mobile-nav-open')) { app.closeNavigation(); return true; }
            if (app.currentPassword && app.currentTab && app.currentTab !== 'dashboard') { app.switchTab('dashboard'); return true; }
            return false;
        };
        (function(){ const mb=document.getElementById('modal-box'); if(mb){ new MutationObserver(()=>{ try{ app.enhanceFields(mb); }catch(e){} }).observe(mb,{childList:true,subtree:true}); } })();
        try { app.applyEdition(); } catch (e) { console.error(e); }
        try { app.setupPageTitleBar(); app.decorateSettings(); } catch (e) { console.error(e); }
        try { app.initSwipe(); } catch (e) { console.error(e); }
        (function(){ const go=()=>{ try{ app.applyNavMode(); app.applyLedgerHeader(); }catch(e){} }; go(); window.addEventListener('resize',go); window.addEventListener('orientationchange',go); const mc=document.getElementById('modal-container'); if(mc) new MutationObserver(()=>{ if(mc.classList.contains('hidden')&&mc.classList.contains('more-sheet')) mc.classList.remove('more-sheet'); }).observe(mc,{attributes:true,attributeFilter:['class']}); })();

        // Shared app-styled information/validation dialog used by all existing alert() call sites.
        (function installAificoAlertDialog(){
            const style=document.createElement('style');
            style.textContent=`#aifico-alert-overlay{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,.68);backdrop-filter:blur(4px)}#aifico-alert-card{box-sizing:border-box;width:min(100%,440px);max-height:85dvh;overflow:auto;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.3);padding:24px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}#aifico-alert-head{display:flex;align-items:flex-start;gap:12px}#aifico-alert-icon{display:flex;align-items:center;justify-content:center;flex:0 0 40px;width:40px;height:40px;border-radius:12px;background:#d1fae5;color:#047857;font-size:20px;font-weight:800}#aifico-alert-title{font-size:17px;font-weight:700;line-height:1.4;letter-spacing:-.02em}#aifico-alert-card p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;margin:12px 0 22px;font-size:14px;color:#475569}#aifico-alert-card button{min-width:84px;border:0;border-radius:11px;background:#059669;color:white;font-weight:650;padding:11px 20px;transition:background .15s ease}#aifico-alert-card button:hover{background:#047857}#aifico-alert-card button:focus-visible{outline:3px solid #6ee7b7;outline-offset:3px}html.dark #aifico-alert-card{background:#0f172a;color:#f8fafc;border-color:#334155}html.dark #aifico-alert-icon{background:rgba(6,78,59,.55);color:#6ee7b7}html.dark #aifico-alert-card p{color:#cbd5e1}html.dark #aifico-alert-card button{background:#059669;color:#fff}html.dark #aifico-alert-card button:hover{background:#047857}@media(max-width:480px){#aifico-alert-card{padding:20px;border-radius:17px}}@media(prefers-reduced-motion:reduce){#aifico-alert-card button{transition:none}}`;
            document.head.appendChild(style);
            const overlay=document.createElement('div');overlay.id='aifico-alert-overlay';overlay.innerHTML='<section id="aifico-alert-card" role="alertdialog" aria-modal="true" aria-labelledby="aifico-alert-title" aria-describedby="aifico-alert-message"><div id="aifico-alert-head"><div id="aifico-alert-icon" aria-hidden="true">i</div><div style="min-width:0;flex:1"><h2 id="aifico-alert-title">aifico Ledger</h2><p id="aifico-alert-message"></p></div></div><div style="display:flex;justify-content:flex-end"><button type="button" id="aifico-alert-ok">OK</button></div></section>';
            document.body.appendChild(overlay);
            let queue=Promise.resolve();
            window.alert=function(message){
                queue=queue.then(()=>new Promise(resolve=>{
                    const title=overlay.querySelector('#aifico-alert-title');
                    const msg=overlay.querySelector('#aifico-alert-message');
                    const ok=overlay.querySelector('#aifico-alert-ok');
                    title.textContent='aifico Ledger'; msg.textContent=String(message??'');
                    const previous=document.activeElement;
                    const finish=()=>{overlay.style.display='none';ok.removeEventListener('click',finish);document.removeEventListener('keydown',keyHandler);if(previous&&previous.focus)previous.focus();resolve();};
                    const keyHandler=e=>{if(e.key==='Escape'||e.key==='Enter'){e.preventDefault();finish();}};
                    ok.addEventListener('click',finish);document.addEventListener('keydown',keyHandler);overlay.style.display='flex';ok.focus();
                }));
                return queue;
            };
        })();
        // v14 accessibility: keep keyboard focus inside an open modal surface.
        (function installAificoFocusContainment(){
            const selector = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
            document.addEventListener('keydown', function(e){
                if(e.key !== 'Tab') return;
                const modal = document.getElementById('modal-container');
                const alertOverlay = document.getElementById('aifico-alert-overlay');
                const activeSurface = alertOverlay && alertOverlay.style.display === 'flex' ? alertOverlay : (modal && !modal.classList.contains('hidden') ? modal : null);
                if(!activeSurface) return;
                const items = [...activeSurface.querySelectorAll(selector)].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
                if(!items.length){ e.preventDefault(); return; }
                const first=items[0], last=items[items.length-1];
                if(e.shiftKey && (document.activeElement===first || !activeSurface.contains(document.activeElement))){ e.preventDefault(); last.focus(); }
                else if(!e.shiftKey && (document.activeElement===last || !activeSurface.contains(document.activeElement))){ e.preventDefault(); first.focus(); }
            }, true);
        })();
        window.onload = () => app.init();
