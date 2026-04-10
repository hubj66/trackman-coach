// auth.js v6 — S1/S2/S3: trend charts, glance strip; minimal auth UI

const sb = window.supabaseClient;
let editingChipId=null,editingPuttId=null;
let chippingCache=[],puttingCache=[];

// ── Helpers ────────────────────────────────────────────────────────────────
function msg(text,isError=false){const el=document.getElementById('auth-message');if(!el)return;el.textContent=text||'';el.style.color=isError?'#ff4d4d':'#00d68f';}
function escapeHtml(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");}
function sum(arr){return arr.reduce((a,b)=>a+(Number(b)||0),0);}
function avg(arr){const v=arr.map(Number).filter(x=>!isNaN(x));return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;}
function fmt(v,dp=1){return(v===null||v===undefined||isNaN(v))?'–':Number(v).toFixed(dp);}
function pct(p,t){return t?((p/t)*100).toFixed(1)+'%':'0%';}
function stdDev(arr){const v=arr.map(Number).filter(x=>!isNaN(x));if(v.length<2)return null;const a=v.reduce((s,x)=>s+x,0)/v.length;return Math.sqrt(v.reduce((s,x)=>s+(x-a)**2,0)/(v.length-1));}

// ── Auth UI ────────────────────────────────────────────────────────────────
function setLoggedInUI(user){
  const lo=document.getElementById('logged-out-view');if(lo)lo.style.display='none';
  const li=document.getElementById('logged-in-view');if(li)li.style.display='block';
  const em=document.getElementById('user-email');if(em)em.textContent=user?.email?.split('@')[0]||'';
  const lbl=document.getElementById('auth-toggle-label');if(lbl)lbl.textContent='Account';
}
function setLoggedOutUI(){
  const lo=document.getElementById('logged-out-view');if(lo)lo.style.display='block';
  const li=document.getElementById('logged-in-view');if(li)li.style.display='none';
  const lbl=document.getElementById('auth-toggle-label');if(lbl)lbl.textContent='Login';
}
async function refreshSession(){
  const{data,error}=await sb.auth.getSession();
  if(error){msg(error.message,true);return;}
  if(data.session?.user){setLoggedInUI(data.session.user);await loadSavedStates();}
  else setLoggedOutUI();
}
async function signUp(){
  const{error}=await sb.auth.signUp({email:document.getElementById('email')?.value?.trim(),password:document.getElementById('password')?.value||''});
  error?msg(error.message,true):msg('Check your email.');
}
async function logIn(){
  const{error}=await sb.auth.signInWithPassword({email:document.getElementById('email')?.value?.trim(),password:document.getElementById('password')?.value||''});
  if(error){msg(error.message,true);return;}
  msg('Logged in');
  document.getElementById('auth-panel').style.display='none';
  await refreshSession();
}
async function logOut(){
  const{error}=await sb.auth.signOut();
  if(error){msg(error.message,true);return;}
  msg('Logged out');setLoggedOutUI();
}

// ── Saved states ───────────────────────────────────────────────────────────
async function loadSavedStates(){
  const{data,error}=await sb.from('saved_states').select('id,title,club,created_at,app_state').order('created_at',{ascending:false});
  if(error)return;
  window.__savedStatesCache=data||[];
  const list=document.getElementById('saved-list-inline');if(!list)return;
  if(!data?.length){list.innerHTML='';return;}
  list.innerHTML=data.slice(0,3).map(row=>`<div class="saved-state-row">
    <span class="saved-state-title">${escapeHtml(row.title)}</span>
    <button onclick="loadOneState('${row.id}')" class="auth-action-btn">Load</button>
    <button onclick="deleteOneState('${row.id}')" class="auth-action-btn auth-action-secondary">✕</button>
  </div>`).join('');
}
async function loadOneState(id){const row=(window.__savedStatesCache||[]).find(x=>x.id===id);if(!row)return;window.trackmanCoach?.applyState(row.app_state);msg('Loaded: '+row.title);}
async function deleteOneState(id){const{error}=await sb.from('saved_states').delete().eq('id',id);if(error){msg(error.message,true);return;}msg('Deleted');await loadSavedStates();}

// ── Stats page ─────────────────────────────────────────────────────────────
async function loadStatsPage(){
  const{data:sd,error:se}=await sb.auth.getSession();
  if(se||!sd.session?.user){
    ['stats-trackman-summary','stats-chipping-summary','stats-putting-summary','clubs-overview'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='<div class="stats-login-note">Log in to see stats.</div>';});
    return;
  }
  await Promise.all([loadTrackmanSummary(),loadChippingSummary(),loadPuttingSummary(),loadClubsOverview(),loadStatsGlance()]);
}

// ── S3: At-a-glance strip ──────────────────────────────────────────────────
async function loadStatsGlance(){
  const el=document.getElementById('stats-glance');if(!el)return;
  try{
    const[tmRes,chipRes,puttRes]=await Promise.all([
      sb.from('trackman_shots').select('carry,is_full_shot,exclude_from_progress,shot_time,created_at').order('shot_time',{ascending:false}).limit(200),
      sb.from('chipping_sessions').select('session_date,attempts,inside_1m,between_1_2m').order('session_date',{ascending:false}).limit(20),
      sb.from('putting_sessions').select('session_date,holed,total').order('session_date',{ascending:false}).limit(20),
    ]);
    const lastTm=tmRes.data?.filter(x=>x.is_full_shot!==false&&x.exclude_from_progress!==true)||[];
    const lastDate=lastTm[0]?.shot_time?.slice(0,10)||lastTm[0]?.created_at?.slice(0,10);
    const lastSessionShots=lastDate?lastTm.filter(x=>(x.shot_time||x.created_at)?.startsWith(lastDate)):[];
    const avgCarry=avg(lastSessionShots.map(x=>x.carry).filter(Boolean));
    const lastChip=chipRes.data?.[0];
    const chipIn2=lastChip?((lastChip.inside_1m||0)+(lastChip.between_1_2m||0)):null;
    const chipAtt=lastChip?.attempts||0;
    const lastPutt=puttRes.data?.[0];
    const puttRate=lastPutt?lastPutt.holed/lastPutt.total:null;
    el.innerHTML=`
      <div class="glance-item"><div class="glance-val">${avgCarry?fmt(avgCarry)+'m':'–'}</div><div class="glance-label">Last TrackMan carry</div></div>
      <div class="glance-sep"></div>
      <div class="glance-item"><div class="glance-val">${chipIn2!=null&&chipAtt?pct(chipIn2,chipAtt):'–'}</div><div class="glance-label">Last chip inside 2m</div></div>
      <div class="glance-sep"></div>
      <div class="glance-item"><div class="glance-val">${puttRate!=null?((puttRate*100).toFixed(0)+'%'):'–'}</div><div class="glance-label">Last putt make rate</div></div>
    `;
  }catch{el.innerHTML='';}
}

// ── TrackMan summary ───────────────────────────────────────────────────────
async function loadTrackmanSummary(){
  const el=document.getElementById('stats-trackman-summary');if(!el)return;
  el.innerHTML='<div class="stats-loading">Loading…</div>';
  const{data,error}=await sb.from('trackman_shots').select('club,carry,smash_factor,ball_speed,club_speed,spin_rate,launch_angle,face_angle,club_path,face_to_path,attack_angle,side,is_full_shot,exclude_from_progress,shot_time,created_at').order('shot_time',{ascending:false}).limit(1000);
  if(error){el.innerHTML=`<div class="stats-error">${escapeHtml(error.message)}</div>`;return;}
  if(!data?.length){el.innerHTML='<div class="stats-empty">No TrackMan shots yet.</div>';return;}
  const progress=data.filter(x=>x.is_full_shot!==false&&x.exclude_from_progress!==true);
  const dates=[...new Set(data.map(x=>(x.shot_time||x.created_at)?.slice(0,10)).filter(Boolean))];
  const avgCarry=avg(progress.map(x=>x.carry).filter(Boolean));
  const avgSmash=avg(progress.map(x=>x.smash_factor).filter(Boolean));
  const avgBSp=avg(progress.map(x=>x.ball_speed).filter(Boolean));
  const carrySD=stdDev(progress.map(x=>x.carry).filter(Boolean));
  const avgFace=avg(progress.map(x=>x.face_angle).filter(x=>x!=null));
  const avgFTP=avg(progress.map(x=>x.face_to_path).filter(x=>x!=null));
  const last5=dates.slice(0,5).map(d=>{const s=progress.filter(x=>(x.shot_time||x.created_at)?.startsWith(d));if(!s.length)return null;return{date:d,n:s.length,carry:avg(s.map(x=>x.carry).filter(Boolean)),smash:avg(s.map(x=>x.smash_factor).filter(Boolean))};}).filter(Boolean);
  const clubCounts={};data.forEach(r=>{const k=r.club||'?';clubCounts[k]=(clubCounts[k]||0)+1;});
  el.innerHTML=`
    <div class="stats-kpi-band">
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${data.length}</div><div class="stats-kpi-tile-label">Total Shots</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${dates.length}</div><div class="stats-kpi-tile-label">Sessions</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${fmt(avgCarry)}m</div><div class="stats-kpi-tile-label">Avg Carry</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${fmt(avgSmash,2)}</div><div class="stats-kpi-tile-label">Smash</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${fmt(avgBSp)} mph</div><div class="stats-kpi-tile-label">Ball Spd</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">±${fmt(carrySD)}m</div><div class="stats-kpi-tile-label">Carry ±</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${avgFace!=null?(avgFace>0?'+':'')+fmt(avgFace):'–'}°</div><div class="stats-kpi-tile-label">Avg Face</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${avgFTP!=null?(avgFTP>0?'+':'')+fmt(avgFTP):'–'}°</div><div class="stats-kpi-tile-label">Avg FTP</div></div>
    </div>
    <div class="stats-note">Progress shots only</div>
    ${last5.length?`<div class="stats-subsection-title">Recent Sessions</div>
    <table class="stats-table"><thead><tr><th>Date</th><th>Shots</th><th>Avg Carry</th><th>Smash</th></tr></thead>
    <tbody>${last5.map(s=>`<tr><td>${s.date}</td><td>${s.n}</td><td>${fmt(s.carry,1)}m</td><td>${fmt(s.smash,2)}</td></tr>`).join('')}</tbody></table>`:''}
    <div class="stats-subsection-title">By Club (raw names)</div>
    <div class="club-count-grid">${Object.entries(clubCounts).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<div class="club-count-item"><span class="club-count-name">${escapeHtml(c)}</span><span class="club-count-val">${n}</span></div>`).join('')}</div>`;
}

// ── S1: Chipping with trend chart ──────────────────────────────────────────
async function loadChippingSummary(){
  const el=document.getElementById('stats-chipping-summary');
  const listEl=document.getElementById('stats-chipping-list');
  if(!el)return;
  const{data,error}=await sb.from('chipping_sessions').select('id,session_date,distance_m,club,attempts,success_target,inside_1m,between_1_2m,between_2_3m,outside_3m,notes,created_at').order('session_date',{ascending:false}).order('created_at',{ascending:false}).limit(100);
  if(error){el.innerHTML=`<div class="stats-error">${escapeHtml(error.message)}</div>`;return;}
  chippingCache=data||[];
  if(!data?.length){el.innerHTML='<div class="stats-empty">No chipping data yet.</div>';const cw=document.getElementById('chipping-chart-wrap');if(cw)cw.style.display='none';if(listEl)listEl.innerHTML='';return;}
  const att=sum(data.map(x=>x.attempts));
  const i1m=sum(data.map(x=>x.inside_1m));
  const i2m=sum(data.map(x=>(x.inside_1m||0)+(x.between_1_2m||0)));
  const i3m=sum(data.map(x=>(x.inside_1m||0)+(x.between_1_2m||0)+(x.between_2_3m||0)));
  el.innerHTML=`<div class="stats-kpi-band">
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${data.length}</div><div class="stats-kpi-tile-label">Sessions</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${att}</div><div class="stats-kpi-tile-label">Attempts</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${pct(i1m,att)}</div><div class="stats-kpi-tile-label">Inside 1m</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${pct(i2m,att)}</div><div class="stats-kpi-tile-label">Inside 2m</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${pct(i3m,att)}</div><div class="stats-kpi-tile-label">Inside 3m</div></div>
  </div>`;
  // Show trend chart
  const cw=document.getElementById('chipping-chart-wrap');
  if(cw){cw.style.display='block';requestAnimationFrame(()=>drawChippingTrend(data));}
  if(listEl)listEl.innerHTML=`<div class="stats-table-wrap"><table class="stats-table">
    <thead><tr><th>Date</th><th>Club</th><th>Dist</th><th>Att</th><th>&lt;1m</th><th>1-2m</th><th>2-3m</th><th>&gt;3m</th><th></th></tr></thead>
    <tbody>${data.slice(0,15).map(r=>`<tr><td>${escapeHtml(r.session_date)}</td><td>${escapeHtml(r.club)}</td><td>${fmt(r.distance_m,1)}m</td><td>${r.attempts}</td><td>${r.inside_1m||0}</td><td>${r.between_1_2m||0}</td><td>${r.between_2_3m||0}</td><td>${r.outside_3m||0}</td>
    <td><div class="inline-actions"><button onclick="startEditChippingSession('${r.id}')">Edit</button><button onclick="deleteChippingSession('${r.id}')">✕</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function drawChippingTrend(data){
  const canvas=document.getElementById('chipping-trend-canvas');if(!canvas)return;
  // Use chronological order, compute inside-2m % per session
  const sorted=[...data].sort((a,b)=>new Date(a.session_date)-new Date(b.session_date));
  const points=sorted.map(r=>{
    const i2=(r.inside_1m||0)+(r.between_1_2m||0);
    const att=r.attempts||0;
    return{date:r.session_date,val:att?i2/att*100:null};
  }).filter(p=>p.val!=null);
  drawSimpleTrendChart(canvas,points,'Inside 2m %','%',0,100,'#00d68f');
}

// ── S2: Putting with trend chart ───────────────────────────────────────────
async function loadPuttingSummary(){
  const el=document.getElementById('stats-putting-summary');
  const listEl=document.getElementById('stats-putting-list');
  if(!el)return;
  const{data,error}=await sb.from('putting_sessions').select('id,session_date,distance_m,holed,total,notes,created_at').order('session_date',{ascending:false}).order('created_at',{ascending:false}).limit(100);
  if(error){el.innerHTML=`<div class="stats-error">${escapeHtml(error.message)}</div>`;return;}
  puttingCache=data||[];
  if(!data?.length){el.innerHTML='<div class="stats-empty">No putting data yet.</div>';const pw=document.getElementById('putting-chart-wrap');if(pw)pw.style.display='none';if(listEl)listEl.innerHTML='';return;}
  const holed=sum(data.map(x=>x.holed)),total=sum(data.map(x=>x.total));
  const byDist={};data.forEach(r=>{const d=fmt(r.distance_m,1);if(!byDist[d])byDist[d]={holed:0,total:0};byDist[d].holed+=r.holed||0;byDist[d].total+=r.total||0;});
  el.innerHTML=`<div class="stats-kpi-band">
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${data.length}</div><div class="stats-kpi-tile-label">Sessions</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${total}</div><div class="stats-kpi-tile-label">Total Putts</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${holed}</div><div class="stats-kpi-tile-label">Holed</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${pct(holed,total)}</div><div class="stats-kpi-tile-label">Make Rate</div></div>
  </div>
  ${Object.keys(byDist).length>1?`<div class="putt-dist-grid">${Object.entries(byDist).sort((a,b)=>parseFloat(a[0])-parseFloat(b[0])).map(([d,v])=>`<div class="putt-dist-card"><div class="putt-dist-label">${d}m</div><div class="putt-dist-rate">${pct(v.holed,v.total)}</div><div class="putt-dist-sub">${v.holed}/${v.total}</div></div>`).join('')}</div>`:''}`;
  const pw=document.getElementById('putting-chart-wrap');
  if(pw){pw.style.display='block';requestAnimationFrame(()=>drawPuttingTrend(data));}
  if(listEl)listEl.innerHTML=`<div class="stats-table-wrap"><table class="stats-table">
    <thead><tr><th>Date</th><th>Dist</th><th>Holed</th><th>Total</th><th>Rate</th><th></th></tr></thead>
    <tbody>${data.slice(0,15).map(r=>`<tr><td>${escapeHtml(r.session_date)}</td><td>${fmt(r.distance_m,1)}m</td><td>${r.holed}</td><td>${r.total}</td><td>${pct(r.holed,r.total)}</td>
    <td><div class="inline-actions"><button onclick="startEditPuttingSession('${r.id}')">Edit</button><button onclick="deletePuttingSession('${r.id}')">✕</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function drawPuttingTrend(data){
  const canvas=document.getElementById('putting-trend-canvas');if(!canvas)return;
  const sorted=[...data].sort((a,b)=>new Date(a.session_date)-new Date(b.session_date));
  const points=sorted.map(r=>({date:r.session_date,val:r.total?r.holed/r.total*100:null})).filter(p=>p.val!=null);
  drawSimpleTrendChart(canvas,points,'Make Rate','%',0,100,'#ffaa00');
}

// ── Shared mini trend chart ────────────────────────────────────────────────
function drawSimpleTrendChart(canvas,points,label,unit,yMin,yMax,color){
  if(!canvas||points.length<2)return;
  const dpr=Math.min(window.devicePixelRatio||2,3);
  const w=canvas.parentElement?.clientWidth||340,h=130;
  canvas.width=w*dpr;canvas.height=h*dpr;
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const values=points.map(p=>p.val);
  const dates=points.map(p=>p.date);
  const pad={t:22,r:16,b:28,l:42};
  const cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  const dataMin=Math.min(...values),dataMax=Math.max(...values);
  const rangeMin=Math.min(yMin,dataMin-5),rangeMax=Math.max(yMax,dataMax+5);
  const px=i=>pad.l+(i/(values.length-1))*cw;
  const py=v=>pad.t+ch-((v-rangeMin)/(rangeMax-rangeMin))*ch;
  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.lineWidth=1;
  ctx.font="9px 'DM Mono',monospace";ctx.fillStyle='#4e5660';ctx.textAlign='right';
  for(let i=0;i<=3;i++){
    const y=pad.t+(ch/3)*i,val=rangeMax-((rangeMax-rangeMin)/3)*i;
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
    ctx.fillText(val.toFixed(0)+unit,pad.l-4,y+3);
  }
  // Area
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
  grad.addColorStop(0,color+'33');grad.addColorStop(1,color+'05');
  ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(px(0),py(values[0]));
  values.forEach((v,i)=>ctx.lineTo(px(i),py(v)));
  ctx.lineTo(px(values.length-1),pad.t+ch);ctx.lineTo(px(0),pad.t+ch);ctx.closePath();ctx.fill();
  // Dots + line
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();values.forEach((v,i)=>i===0?ctx.moveTo(px(i),py(v)):ctx.lineTo(px(i),py(v)));ctx.stroke();
  ctx.fillStyle=color;
  values.forEach((v,i)=>{ctx.beginPath();ctx.arc(px(i),py(v),3,0,Math.PI*2);ctx.fill();});
  // Trend
  const n=values.length,sX=values.reduce((_,__,i)=>_+i,0),sY=values.reduce((a,b)=>a+b,0);
  const sXY=values.reduce((a,v,i)=>a+i*v,0),sX2=values.reduce((a,_,i)=>a+i*i,0);
  const slope=(n*sXY-sX*sY)/(n*sX2-sX*sX),intercept=(sY-slope*sX)/n;
  const tCol=slope>0.1?'#00d68f':slope<-0.1?'#ff4d4d':'#8a9099';
  ctx.strokeStyle=tCol;ctx.lineWidth=1.5;ctx.globalAlpha=0.6;ctx.setLineDash([6,4]);
  ctx.beginPath();ctx.moveTo(px(0),py(intercept));ctx.lineTo(px(n-1),py(slope*(n-1)+intercept));ctx.stroke();
  ctx.setLineDash([]);ctx.globalAlpha=1;
  // Labels
  ctx.fillStyle='#f0ede8';ctx.font="700 10px 'Barlow Condensed',sans-serif";ctx.textAlign='left';
  ctx.fillText(label,pad.l,pad.t-8);
  const diff=slope*(n-1),arrow=slope>0.1?'↑':slope<-0.1?'↓':'→';
  ctx.fillStyle=tCol;ctx.textAlign='right';ctx.font="700 10px 'Barlow Condensed',sans-serif";
  ctx.fillText(`${arrow} ${diff>0?'+':''}${diff.toFixed(1)}${unit}`,w-pad.r,pad.t-8);
  // Date labels bottom
  ctx.fillStyle='#4e5660';ctx.font="9px 'DM Mono',monospace";ctx.textAlign='center';
  const step=Math.max(1,Math.floor(dates.length/4));
  dates.forEach((d,i)=>{if(i%step===0)ctx.fillText(d.slice(5),px(i),pad.t+ch+16);});
}

// ── Clubs ──────────────────────────────────────────────────────────────────
async function loadClubsOverview(){
  const el=document.getElementById('clubs-overview');if(!el)return;
  el.innerHTML='<div class="stats-loading">Loading…</div>';
  const CA=window.clubAliases;await CA.loadAliases();
  const[clubsRes,shotsRes]=await Promise.all([
    sb.from('clubs').select('club_key,club_name,club_type,brand,model,loft,is_active').eq('is_active',true).order('club_name'),
    sb.from('trackman_shots').select('club,carry,smash_factor,ball_speed,spin_rate,launch_angle,face_angle,club_path,side,is_full_shot,exclude_from_progress').limit(2000)
  ]);
  if(clubsRes.error||!clubsRes.data?.length){el.innerHTML='<div class="stats-empty">No clubs in the clubs table.</div>';const am=document.getElementById('alias-manager');if(am&&typeof renderAliasManager==='function')renderAliasManager();return;}
  const progressShots=(shotsRes.data||[]).filter(s=>s.is_full_shot!==false&&s.exclude_from_progress!==true);
  const grouped=CA.groupShotsByClub(progressShots);
  el.innerHTML=`<div class="clubs-grid">${clubsRes.data.map(row=>{
    const shots=grouped[row.club_key]||[];
    const carries=shots.map(s=>s.carry).filter(Boolean);
    const avgCarry=avg(carries),medC=[...carries].sort((a,b)=>a-b)[Math.floor(carries.length/2)];
    const carrySD=stdDev(carries),avgSmash=avg(shots.map(s=>s.smash_factor).filter(Boolean));
    const avgSpin=avg(shots.map(s=>s.spin_rate).filter(Boolean));
    const sides=shots.map(s=>s.side).filter(x=>x!=null),avgSide=avg(sides);
    const miss=!avgSide?'–':avgSide>5?'Right':avgSide<-5?'Left':'Straight';
    const hasData=shots.length>0;
    return`<div class="club-card" onclick="openClubInAnalysis('${escapeHtml(row.club_key||'')}')">
      <div class="club-card-header">
        <div class="club-card-name">${escapeHtml(row.club_name)}</div>
        <div class="club-card-badge">${hasData?shots.length+' shots':'No data'}</div>
      </div>
      ${row.brand||row.model?`<div class="club-card-model">${escapeHtml([row.brand,row.model].filter(Boolean).join(' '))}</div>`:''}
      ${hasData?`<div class="club-stats-grid">
        <div class="club-stat"><div class="club-stat-label">Avg Carry</div><div class="club-stat-val">${fmt(avgCarry)}m</div></div>
        <div class="club-stat"><div class="club-stat-label">Median</div><div class="club-stat-val">${fmt(medC)}m</div></div>
        <div class="club-stat"><div class="club-stat-label">Carry ±</div><div class="club-stat-val">${fmt(carrySD)}m</div></div>
        <div class="club-stat"><div class="club-stat-label">Smash</div><div class="club-stat-val">${fmt(avgSmash,2)}</div></div>
        <div class="club-stat"><div class="club-stat-label">Spin</div><div class="club-stat-val">${avgSpin?Math.round(avgSpin):'–'}</div></div>
        <div class="club-stat"><div class="club-stat-label">Miss</div><div class="club-stat-val">${miss}</div></div>
      </div><div class="club-card-cta">Tap to analyse →</div>`:`<div class="club-card-nodata">No shots mapped yet</div>`}
    </div>`;
  }).join('')}</div>`;
  const am=document.getElementById('alias-manager');
  if(am&&typeof renderAliasManager==='function')renderAliasManager();
}

function openClubInAnalysis(k){if(!k)return;showPage('analysis');if(typeof setAnalysisClub==='function')setAnalysisClub(k);}

// ── Chipping CRUD ───────────────────────────────────────────────────────────
async function addChippingSession(){
  const{data:sd,error:se}=await sb.auth.getSession();if(se){msg(se.message,true);return;}
  const user=sd.session?.user;if(!user){msg('Please log in',true);return;}
  const session_date=document.getElementById('chip-date')?.value,distance_m=Number(document.getElementById('chip-distance')?.value);
  const club=document.getElementById('chip-club')?.value?.trim(),attempts=Number(document.getElementById('chip-attempts')?.value);
  const inside_1m=Number(document.getElementById('chip-in1')?.value||0),between_1_2m=Number(document.getElementById('chip-in2')?.value||0);
  const between_2_3m=Number(document.getElementById('chip-in3')?.value||0),outside_3m=Number(document.getElementById('chip-out3')?.value||0);
  const success_target_raw=document.getElementById('chip-success')?.value,notes=document.getElementById('chip-notes')?.value?.trim()||null;
  if(!session_date||!club||!distance_m||!attempts){msg('Fill date, distance, club and attempts',true);return;}
  if(inside_1m+between_1_2m+between_2_3m+outside_3m>attempts){msg('Bucket totals exceed attempts',true);return;}
  const success_target=success_target_raw===''||success_target_raw==null?null:Number(success_target_raw);
  const{error}=await sb.from('chipping_sessions').insert({user_id:user.id,session_date,distance_m,club,attempts,success_target,inside_1m,between_1_2m,between_2_3m,outside_3m,notes});
  if(error){msg(error.message,true);return;}
  msg('Session added');clearChippingForm();await loadChippingSummary();
}
async function updateChippingSession(){
  if(!editingChipId)return;
  const session_date=document.getElementById('chip-date')?.value,distance_m=Number(document.getElementById('chip-distance')?.value);
  const club=document.getElementById('chip-club')?.value?.trim(),attempts=Number(document.getElementById('chip-attempts')?.value);
  const inside_1m=Number(document.getElementById('chip-in1')?.value||0),between_1_2m=Number(document.getElementById('chip-in2')?.value||0);
  const between_2_3m=Number(document.getElementById('chip-in3')?.value||0),outside_3m=Number(document.getElementById('chip-out3')?.value||0);
  const success_target_raw=document.getElementById('chip-success')?.value,notes=document.getElementById('chip-notes')?.value?.trim()||null;
  if(!session_date||!club||!distance_m||!attempts){msg('Fill date, distance, club and attempts',true);return;}
  if(inside_1m+between_1_2m+between_2_3m+outside_3m>attempts){msg('Bucket totals exceed attempts',true);return;}
  const success_target=success_target_raw===''||success_target_raw==null?null:Number(success_target_raw);
  const{error}=await sb.from('chipping_sessions').update({session_date,distance_m,club,attempts,success_target,inside_1m,between_1_2m,between_2_3m,outside_3m,notes}).eq('id',editingChipId);
  if(error){msg(error.message,true);return;}
  msg('Updated');cancelEditChippingSession();await loadChippingSummary();
}
function startEditChippingSession(id){const r=chippingCache.find(x=>x.id===id);if(!r)return;editingChipId=id;document.getElementById('chip-date').value=r.session_date||'';document.getElementById('chip-distance').value=r.distance_m??'';document.getElementById('chip-club').value=r.club||'';document.getElementById('chip-attempts').value=r.attempts??'';document.getElementById('chip-in1').value=r.inside_1m??0;document.getElementById('chip-in2').value=r.between_1_2m??0;document.getElementById('chip-in3').value=r.between_2_3m??0;document.getElementById('chip-out3').value=r.outside_3m??0;document.getElementById('chip-success').value=r.success_target??'';document.getElementById('chip-notes').value=r.notes||'';document.getElementById('add-chip-btn').style.display='none';document.getElementById('update-chip-btn').style.display='inline-block';document.getElementById('cancel-chip-edit-btn').style.display='inline-block';}
function cancelEditChippingSession(){editingChipId=null;clearChippingForm();document.getElementById('add-chip-btn').style.display='inline-block';document.getElementById('update-chip-btn').style.display='none';document.getElementById('cancel-chip-edit-btn').style.display='none';}
async function deleteChippingSession(id){const{error}=await sb.from('chipping_sessions').delete().eq('id',id);if(error){msg(error.message,true);return;}if(editingChipId===id)cancelEditChippingSession();msg('Deleted');await loadChippingSummary();}
function clearChippingForm(){['chip-date','chip-distance','chip-club','chip-attempts','chip-in1','chip-in2','chip-in3','chip-out3','chip-success','chip-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});}

// ── Putting CRUD ─────────────────────────────────────────────────────────────
async function addPuttingSession(){
  const{data:sd,error:se}=await sb.auth.getSession();if(se){msg(se.message,true);return;}
  const user=sd.session?.user;if(!user){msg('Please log in',true);return;}
  const session_date=document.getElementById('putt-date')?.value,distance_m=Number(document.getElementById('putt-distance')?.value);
  const holed=Number(document.getElementById('putt-holed')?.value),total=Number(document.getElementById('putt-total')?.value);
  const notes=document.getElementById('putt-notes')?.value?.trim()||null;
  if(!session_date||!distance_m||total<=0||holed<0){msg('Fill all fields',true);return;}
  if(holed>total){msg('Holed cannot exceed total',true);return;}
  const{error}=await sb.from('putting_sessions').insert({user_id:user.id,session_date,distance_m,holed,total,notes});
  if(error){msg(error.message,true);return;}
  msg('Session added');clearPuttingForm();await loadPuttingSummary();
}
async function updatePuttingSession(){
  if(!editingPuttId)return;
  const session_date=document.getElementById('putt-date')?.value,distance_m=Number(document.getElementById('putt-distance')?.value);
  const holed=Number(document.getElementById('putt-holed')?.value),total=Number(document.getElementById('putt-total')?.value);
  const notes=document.getElementById('putt-notes')?.value?.trim()||null;
  if(!session_date||!distance_m||total<=0||holed<0){msg('Fill all fields',true);return;}
  if(holed>total){msg('Holed cannot exceed total',true);return;}
  const{error}=await sb.from('putting_sessions').update({session_date,distance_m,holed,total,notes}).eq('id',editingPuttId);
  if(error){msg(error.message,true);return;}
  msg('Updated');cancelEditPuttingSession();await loadPuttingSummary();
}
function startEditPuttingSession(id){const r=puttingCache.find(x=>x.id===id);if(!r)return;editingPuttId=id;document.getElementById('putt-date').value=r.session_date||'';document.getElementById('putt-distance').value=r.distance_m??'';document.getElementById('putt-holed').value=r.holed??'';document.getElementById('putt-total').value=r.total??'';document.getElementById('putt-notes').value=r.notes||'';document.getElementById('add-putt-btn').style.display='none';document.getElementById('update-putt-btn').style.display='inline-block';document.getElementById('cancel-putt-edit-btn').style.display='inline-block';}
function cancelEditPuttingSession(){editingPuttId=null;clearPuttingForm();document.getElementById('add-putt-btn').style.display='inline-block';document.getElementById('update-putt-btn').style.display='none';document.getElementById('cancel-putt-edit-btn').style.display='none';}
async function deletePuttingSession(id){const{error}=await sb.from('putting_sessions').delete().eq('id',id);if(error){msg(error.message,true);return;}if(editingPuttId===id)cancelEditPuttingSession();msg('Deleted');await loadPuttingSummary();}
function clearPuttingForm(){['putt-date','putt-distance','putt-holed','putt-total','putt-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});}

// ── Exports ───────────────────────────────────────────────────────────────
window.loadOneState=loadOneState;window.deleteOneState=deleteOneState;
window.loadStatsPage=loadStatsPage;
window.startEditChippingSession=startEditChippingSession;window.deleteChippingSession=deleteChippingSession;window.cancelEditChippingSession=cancelEditChippingSession;
window.startEditPuttingSession=startEditPuttingSession;window.deletePuttingSession=deletePuttingSession;window.cancelEditPuttingSession=cancelEditPuttingSession;
window.openClubInAnalysis=openClubInAnalysis;

window.addEventListener('DOMContentLoaded',async()=>{
  const b=(id,fn)=>{const e=document.getElementById(id);if(e)e.addEventListener('click',fn);};
  b('signup-btn',signUp);b('login-btn',logIn);b('logout-btn',logOut);
  b('add-chip-btn',addChippingSession);b('update-chip-btn',updateChippingSession);b('cancel-chip-edit-btn',cancelEditChippingSession);
  b('add-putt-btn',addPuttingSession);b('update-putt-btn',updatePuttingSession);b('cancel-putt-edit-btn',cancelEditPuttingSession);
  await refreshSession();
});
