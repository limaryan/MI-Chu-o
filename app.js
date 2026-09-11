const cfg = window.MICHUNO_CONFIG || {};
const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes('COLE_') && !cfg.SUPABASE_ANON_KEY.includes('COLE_');
const sb = configured ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
const state = { user:null, profile:null, entries:[], closings:[] };

const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const parseMoney = s => Number(String(s).replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'')) || 0;
const todayISO = () => new Date().toISOString().slice(0,10);
const monthKey = d => { const x=new Date(d+'T12:00:00'); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`; };
const currentMonthKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const monthLabel = ym => { const [y,m]=ym.split('-').map(Number); return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}); };

function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(window.__tt); window.__tt=setTimeout(()=>t.classList.add('hidden'),2600); }
function showView(id){ ['authView','setupView','appView'].forEach(v=>$(v).classList.toggle('hidden',v!==id)); }
function showPage(name){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active-page')); $(`page-${name}`).classList.add('active-page'); document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===name)); if(innerWidth<900)$('sidebar').classList.remove('open'); if(name==='fechamento')renderClosing(); if(name==='historico')renderHistory(); if(name==='projecoes')renderProjections(); if(name==='configuracoes')fillSettings(); }

async function boot(){
  $('incomeDate').value=todayISO(); $('expenseDate').value=todayISO();
  if(!configured){ $('supabaseWarning').classList.remove('hidden'); showView('authView'); return; }
  const {data:{session}}=await sb.auth.getSession();
  if(session){ state.user=session.user; await loadAll(); } else showView('authView');
  sb.auth.onAuthStateChange(async(_event,session)=>{ if(session){state.user=session.user; await loadAll();} else {state.user=null;state.profile=null;state.entries=[];showView('authView');} });
}

async function loadAll(){
  const [{data:profile},{data:entries},{data:closings}] = await Promise.all([
    sb.from('profiles').select('*').eq('id',state.user.id).maybeSingle(),
    sb.from('entries').select('*').eq('user_id',state.user.id).order('entry_date',{ascending:false}),
    sb.from('month_closings').select('*').eq('user_id',state.user.id).order('period',{ascending:false})
  ]);
  state.profile=profile||null; state.entries=entries||[]; state.closings=closings||[];
  if(!state.profile){ $('setupName').value=state.user.user_metadata?.name||''; showView('setupView'); return; }
  showView('appView'); renderAll();
}

function monthEntries(){ const key=currentMonthKey(); return state.entries.filter(e=>monthKey(e.entry_date)===key); }
function calc(entries=monthEntries()){
  const confirmed=entries.filter(e=>e.confirmed);
  const income=confirmed.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
  const expense=confirmed.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
  return {income,expense,balance:income-expense};
}

function renderAll(){
  const c=calc();
  $('balanceValue').textContent=money(c.balance); $('incomeTotal').textContent=money(c.income); $('expenseTotal').textContent=money(c.expense); $('entryCount').textContent=monthEntries().length;
  const name=state.profile?.name?.split(' ')[0]||'Você';
  $('balanceMessage').textContent = c.balance>0 ? `${name}, seu saldo está positivo em ${money(c.balance)}.` : c.balance<0 ? `${name}, suas despesas estão ${money(Math.abs(c.balance))} maiores que suas receitas.` : `${name}, seu saldo está zerado neste mês.`;
  const day=Number(state.profile?.closing_day||5), now=new Date(); let next=new Date(now.getFullYear(),now.getMonth(),day); if(now.getDate()>day)next=new Date(now.getFullYear(),now.getMonth()+1,day); const diff=Math.max(0,Math.ceil((next-now)/(1000*60*60*24)));
  $('closingMessage').textContent = `${name}, em ${diff} dia${diff===1?'':'s'} (${String(next.getDate()).padStart(2,'0')}/${String(next.getMonth()+1).padStart(2,'0')}) é o dia definido para fechar suas finanças.`;
  renderEntries();
}

function renderEntries(){
  const key=currentMonthKey();
  const incomes=state.entries.filter(e=>e.type==='income' && (e.is_fixed || monthKey(e.entry_date)===key));
  const expenses=state.entries.filter(e=>e.type==='expense' && (e.is_fixed || monthKey(e.entry_date)===key));
  renderList('incomeList',incomes); renderList('expenseList',expenses);
  $('incomeListTotal').textContent=money(incomes.filter(e=>e.confirmed && monthKey(e.entry_date)===key).reduce((s,e)=>s+Number(e.amount),0));
  $('expenseListTotal').textContent=money(expenses.filter(e=>e.confirmed && monthKey(e.entry_date)===key).reduce((s,e)=>s+Number(e.amount),0));
}

function renderList(target,arr){
  const el=$(target); el.innerHTML='';
  if(!arr.length){el.innerHTML='<p class="muted">Nenhum lançamento cadastrado.</p>';return;}
  arr.forEach(e=>{const row=document.createElement('div');row.className='list-item';row.innerHTML=`<div><div class="item-title">${escapeHtml(e.name)}</div><div class="item-meta">${escapeHtml(e.category||'Outros')} • ${new Date(e.entry_date+'T12:00:00').toLocaleDateString('pt-BR')} ${e.is_fixed?'• fixo':''} ${e.confirmed?'• confirmado':'• fora do saldo'}</div></div><div class="item-value">${money(e.amount)}</div><button class="icon-btn" data-del="${e.id}">Excluir</button>`;el.appendChild(row);});
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>deleteEntry(b.dataset.del));
}

async function addEntry(type){
  const p=type==='income'?'income':'expense';
  const payload={user_id:state.user.id,type,name:$(`${p}Name`).value.trim(),amount:parseMoney($(`${p}Value`).value),category:$(`${p}Category`).value,entry_date:$(`${p}Date`).value,confirmed:$(`${p}Confirmed`).checked,is_fixed:$(`${p}Fixed`).checked};
  if(!payload.name||payload.amount<=0)return toast('Informe nome e valor válido.');
  const {data,error}=await sb.from('entries').insert(payload).select().single(); if(error)return toast(error.message);
  state.entries.unshift(data); $(`${p}Form`).reset(); $(`${p}Date`).value=todayISO(); $(`${p}Confirmed`).checked=true; renderAll(); toast(type==='income'?'Receita salva.':'Despesa salva.');
}

async function deleteEntry(id){ if(!confirm('Excluir este lançamento?'))return; const {error}=await sb.from('entries').delete().eq('id',id); if(error)return toast(error.message); state.entries=state.entries.filter(e=>String(e.id)!==String(id)); renderAll(); toast('Lançamento excluído.'); }

function renderClosing(){
  const entries=monthEntries(); const el=$('closingEntries'); el.innerHTML='';
  if(!entries.length)el.innerHTML='<p class="muted">Nenhum lançamento neste mês.</p>';
  entries.forEach(e=>{const r=document.createElement('label');r.className='closing-row';r.innerHTML=`<input type="checkbox" data-close-check="${e.id}" ${e.confirmed?'checked':''}><div><b>${escapeHtml(e.name)}</b><div class="item-meta">${e.type==='income'?'Receita':'Despesa'} • ${escapeHtml(e.category||'Outros')}</div></div><strong>${money(e.amount)}</strong>`;el.appendChild(r)});
  el.querySelectorAll('[data-close-check]').forEach(ch=>ch.onchange=()=>updateConfirmed(ch.dataset.closeCheck,ch.checked)); updateClosingSummary();
}
async function updateConfirmed(id,value){ const {error}=await sb.from('entries').update({confirmed:value}).eq('id',id); if(error)return toast(error.message); const e=state.entries.find(x=>String(x.id)===String(id)); if(e)e.confirmed=value; renderAll(); renderClosing(); }
function updateClosingSummary(){ const c=calc(); $('closeIncome').textContent=money(c.income);$('closeExpense').textContent=money(c.expense);$('closeBalance').textContent=money(c.balance); }

async function closeMonth(){
  const period=currentMonthKey(); const c=calc();
  if(state.closings.some(x=>x.period===period) && !confirm('Este mês já foi fechado. Deseja atualizar o fechamento?'))return;
  const payload={user_id:state.user.id,period,total_income:c.income,total_expense:c.expense,balance:c.balance,closed_at:new Date().toISOString()};
  const {data,error}=await sb.from('month_closings').upsert(payload,{onConflict:'user_id,period'}).select().single(); if(error)return toast(error.message);
  state.closings=state.closings.filter(x=>x.period!==period); state.closings.unshift(data); toast('Mês fechado com sucesso.'); renderHistory(); renderProjections(); showPage('dashboard');
}

function renderHistory(){ const el=$('historyList');el.innerHTML=''; if(!state.closings.length){el.innerHTML='<p class="muted">Nenhum mês fechado ainda.</p>';return;} state.closings.forEach(c=>{const d=document.createElement('div');d.className='history-card';d.innerHTML=`<h3>${capitalize(monthLabel(c.period))}</h3><div><span>Receitas</span><b>${money(c.total_income)}</b></div><div><span>Despesas</span><b>${money(c.total_expense)}</b></div><div><span>Saldo</span><b>${money(c.balance)}</b></div>`;el.appendChild(d)}); }
function renderProjections(){ if(!state.closings.length){$('avgIncome').textContent=money(0);$('avgExpense').textContent=money(0);$('avgBalance').textContent=money(0);return;} const n=state.closings.length; $('avgIncome').textContent=money(state.closings.reduce((s,x)=>s+Number(x.total_income),0)/n); $('avgExpense').textContent=money(state.closings.reduce((s,x)=>s+Number(x.total_expense),0)/n); $('avgBalance').textContent=money(state.closings.reduce((s,x)=>s+Number(x.balance),0)/n); }
function fillSettings(){ $('settingsName').value=state.profile?.name||''; $('settingsClosingDay').value=state.profile?.closing_day||5; }

async function exportData(){ const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),profile:state.profile,entries:state.entries,closings:state.closings},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`michuno-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href); }
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));} function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1)}

// Eventos de autenticação
document.querySelectorAll('[data-auth-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-auth-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('loginForm').classList.toggle('hidden',b.dataset.authTab!=='login');$('registerForm').classList.toggle('hidden',b.dataset.authTab!=='register');});
$('loginForm').onsubmit=async e=>{e.preventDefault();if(!sb)return toast('Configure o Supabase primeiro.');const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value,password:$('loginPassword').value});if(error)toast(error.message)};
$('registerForm').onsubmit=async e=>{e.preventDefault();if(!sb)return toast('Configure o Supabase primeiro.');if($('registerPassword').value!==$('registerPassword2').value)return toast('As senhas não coincidem.');const {error}=await sb.auth.signUp({email:$('registerEmail').value,password:$('registerPassword').value,options:{data:{name:$('registerName').value.trim()}}});if(error)return toast(error.message);toast('Conta criada. Se o Supabase pedir confirmação por e-mail, confirme antes de entrar.');};
$('setupForm').onsubmit=async e=>{e.preventDefault();const payload={id:state.user.id,name:$('setupName').value.trim(),closing_day:Number($('setupClosingDay').value)};const {data,error}=await sb.from('profiles').upsert(payload).select().single();if(error)return toast(error.message);state.profile=data;showView('appView');renderAll();};
$('setupLogout').onclick=$('logoutBtn').onclick=()=>sb?.auth.signOut();

// Navegação
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));document.querySelectorAll('[data-page-link]').forEach(b=>b.onclick=()=>showPage(b.dataset.pageLink));$('toggleSidebar').onclick=()=>$('sidebar').classList.toggle('collapsed');$('mobileMenu').onclick=()=>$('sidebar').classList.toggle('open');

$('incomeForm').onsubmit=e=>{e.preventDefault();addEntry('income')};$('expenseForm').onsubmit=e=>{e.preventDefault();addEntry('expense')};$('closeMonthBtn').onclick=closeMonth;
$('settingsForm').onsubmit=async e=>{e.preventDefault();const patch={name:$('settingsName').value.trim(),closing_day:Number($('settingsClosingDay').value)};const {data,error}=await sb.from('profiles').update(patch).eq('id',state.user.id).select().single();if(error)return toast(error.message);state.profile=data;renderAll();toast('Configurações salvas.');};$('exportBtn').onclick=exportData;

boot();
