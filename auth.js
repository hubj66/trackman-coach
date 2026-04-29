// auth.js v9

const sb = window.supabaseClient;
let editingChipId=null,editingPuttId=null;
let _currentUserId=null;
let chippingCache=[],puttingCache=[];
let _practiceSessionsAvailable=true;
let _bagOnCourseGrouped={};
let _pendingRoundImport=null;

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
  if(data.session?.user){
    setLoggedInUI(data.session.user);
    _currentUserId=data.session.user.id;
    await loadSavedStates();
    const meta=data.session.user.user_metadata;
    if(meta?.theme && typeof applyTheme==='function') applyTheme(meta.theme);
  }
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
  msg('Logged out');_currentUserId=null;setLoggedOutUI();
}

// ── Saved states ───────────────────────────────────────────────────────────
async function loadSavedStates(){
  if(!_currentUserId)return;
  const{data,error}=await sb.from('saved_states').select('id,title,club,created_at,app_state').eq('user_id',_currentUserId).order('created_at',{ascending:false});
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
async function deleteOneState(id){if(!_currentUserId)return;const{error}=await sb.from('saved_states').delete().eq('id',id).eq('user_id',_currentUserId);if(error){msg(error.message,true);return;}msg('Deleted');await loadSavedStates();}

// ── Stats page ─────────────────────────────────────────────────────────────
async function loadStatsPage(){
  const{data:sd,error:se}=await sb.auth.getSession();
  if(se||!sd.session?.user){
    ['stats-chipping-summary','stats-putting-summary','clubs-overview','stats-practice-range','stats-practice-course'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='<div class="stats-login-note">Log in to see stats.</div>';});
    return;
  }
  _currentUserId=sd.session.user.id;
  await Promise.all([
    loadTournamentPanel(),
    loadTrackmanSummary(),
    loadChippingSummary(),
    loadPuttingSummary(),
    loadClubsOverview(),
    loadStatsGlance(),
    loadPracticeSessions(),
    loadRoundsSummary()
  ]);
}

// ── Tournament countdown panel ─────────────────────────────────────────────
async function loadTournamentPanel(){
  const el=document.getElementById('stats-tournament');if(!el)return;
  const TOURNAMENT=new Date('2026-05-10');
  const now=new Date();
  const daysLeft=Math.ceil((TOURNAMENT-now)/86400000);
  if(daysLeft<0){el.style.display='none';return;}

  // Fetch latest KPI data
  const[chipRes,puttRes,tmRes]=await Promise.all([
    sb.from('chipping_sessions').select('attempts,inside_1m,between_1_2m').eq('user_id',_currentUserId).order('session_date',{ascending:false}).limit(5),
    sb.from('putting_sessions').select('holed,total,distance_m').eq('user_id',_currentUserId).order('session_date',{ascending:false}).limit(5),
    sb.from('trackman_shots').select('carry,face_angle,is_full_shot,exclude_from_progress,shot_time,created_at').eq('user_id',_currentUserId).order('shot_time',{ascending:false}).limit(100),
  ]);

  // Chip inside 2m %
  const chipData=chipRes.data||[];
  const chipAtt=sum(chipData.map(x=>x.attempts));
  const chipIn2=sum(chipData.map(x=>(x.inside_1m||0)+(x.between_1_2m||0)));
  const chipPct=chipAtt?chipIn2/chipAtt*100:null;

  // 1m putt make %
  const puttData=(puttRes.data||[]).filter(r=>r.distance_m<=1.5);
  const puttHoled=sum(puttData.map(x=>x.holed));
  const puttTotal=sum(puttData.map(x=>x.total));
  const puttPct=puttTotal?puttHoled/puttTotal*100:null;

  // Last 7i carry avg
  const tmShots=(tmRes.data||[]).filter(s=>s.is_full_shot!==false&&s.exclude_from_progress!==true);
  const carryAvg=avg(tmShots.slice(0,30).map(s=>s.carry).filter(Boolean));

  function trafficLight(val,target,low){
    if(val==null)return'kpi-tl-none';
    if(val>=target)return'kpi-tl-green';
    if(val>=low)return'kpi-tl-amber';
    return'kpi-tl-red';
  }

  el.style.display='block';
  el.innerHTML=`
    <div class="tournament-header">
      <div class="tournament-title">Golfpark Otelfingen</div>
      <div class="tournament-days">${daysLeft} days</div>
    </div>
    <div class="tournament-kpis">
      <div class="tournament-kpi ${trafficLight(chipPct,75,60)}">
        <div class="tkpi-val">${chipPct!=null?chipPct.toFixed(0)+'%':'–'}</div>
        <div class="tkpi-label">Chip inside 2m</div>
        <div class="tkpi-target">target 75%</div>
      </div>
      <div class="tournament-kpi ${trafficLight(puttPct,85,74)}">
        <div class="tkpi-val">${puttPct!=null?puttPct.toFixed(0)+'%':'–'}</div>
        <div class="tkpi-label">1m putts made</div>
        <div class="tkpi-target">target 85%</div>
      </div>
      <div class="tournament-kpi ${trafficLight(carryAvg,105,95)}">
        <div class="tkpi-val">${carryAvg!=null?Math.round(carryAvg)+'m':'–'}</div>
        <div class="tkpi-label">Avg carry</div>
        <div class="tkpi-target">target 105m+</div>
      </div>
    </div>`;
}

// ── S3: At-a-glance strip ──────────────────────────────────────────────────
async function loadStatsGlance(){
  const el=document.getElementById('stats-glance');if(!el)return;
  try{
    const[tmRes,chipRes,puttRes]=await Promise.all([
      sb.from('trackman_shots').select('carry,is_full_shot,exclude_from_progress,shot_time,created_at').eq('user_id',_currentUserId).order('shot_time',{ascending:false}).limit(200),
      sb.from('chipping_sessions').select('session_date,attempts,inside_1m,between_1_2m').eq('user_id',_currentUserId).order('session_date',{ascending:false}).limit(20),
      sb.from('putting_sessions').select('session_date,holed,total').eq('user_id',_currentUserId).order('session_date',{ascending:false}).limit(20),
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
  const{data,error}=await sb.from('trackman_shots').select('club,carry,smash_factor,ball_speed,club_speed,spin_rate,launch_angle,face_angle,club_path,face_to_path,attack_angle,side,is_full_shot,exclude_from_progress,shot_time,created_at').eq('user_id',_currentUserId).order('shot_time',{ascending:false}).limit(1000);
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
  const last5=dates.slice(0,5).map(d=>{const s=progress.filter(x=>(x.shot_time||x.created_at)?.startsWith(d));if(!s.length)return null;return{date:d,n:s.length,carry:avg(s.map(x=>x.carry).filter(Boolean)),smash:avg(s.map(x=>x.smash_factor).filter(Boolean)),face:avg(s.map(x=>x.face_angle).filter(x=>x!=null))};}).filter(Boolean);

  // Per-canonical-club breakdown using alias mapping
  const CA=window.clubAliases;
  let clubTableHtml='';
  if(CA){
    await CA.loadAliases();
    const BAG_ORDER=['driver','3w','5w','4','5','6','7','8','9','pw','sw','58','putter'];
    const grouped=CA.groupShotsByClub(progress);
    const clubRows=BAG_ORDER.filter(key=>(grouped[key]||[]).length>0).map(key=>{
      const shots=grouped[key];
      const carries=shots.map(x=>x.carry).filter(Boolean);
      const smashes=shots.map(x=>x.smash_factor).filter(Boolean);
      const faces=shots.map(x=>x.face_angle).filter(x=>x!=null);
      return{label:CA.clubLabel(key),key,n:shots.length,carry:avg(carries),carrySD:stdDev(carries),smash:avg(smashes),face:avg(faces)};
    });
    if(clubRows.length){
      clubTableHtml=`<div class="stats-subsection-title">By Club</div>
      <div class="stats-table-wrap"><table class="stats-table">
        <thead><tr><th>Club</th><th>Shots</th><th>Avg Carry</th><th>Carry ±</th><th>Smash</th><th>Avg Face</th></tr></thead>
        <tbody>${clubRows.map(r=>`<tr>
          <td><strong>${escapeHtml(r.label)}</strong></td>
          <td>${r.n}</td>
          <td>${fmt(r.carry,1)}m</td>
          <td>±${r.carrySD!=null?fmt(r.carrySD,1):'–'}m</td>
          <td>${fmt(r.smash,2)}</td>
          <td class="${r.face!=null&&Math.abs(r.face)<=2?'cell-good':r.face!=null&&Math.abs(r.face)<=4?'cell-warn':'cell-bad'}">${r.face!=null?(r.face>0?'+':'')+fmt(r.face,1)+'°':'–'}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    }
  }

  el.innerHTML=`
    <div class="stats-kpi-band">
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${data.length}</div><div class="stats-kpi-tile-label">Total Shots</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${dates.length}</div><div class="stats-kpi-tile-label">Sessions</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${fmt(avgSmash,2)}</div><div class="stats-kpi-tile-label">Smash</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${fmt(avgBSp)} m/s</div><div class="stats-kpi-tile-label">Ball Spd</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${avgFace!=null?(avgFace>0?'+':'')+fmt(avgFace):'–'}°</div><div class="stats-kpi-tile-label">Avg Face</div></div>
      <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${avgFTP!=null?(avgFTP>0?'+':'')+fmt(avgFTP):'–'}°</div><div class="stats-kpi-tile-label">Avg FTP</div></div>
    </div>
    <div class="stats-note">Progress shots only (full swings, not excluded)</div>
    ${last5.length?`<div class="stats-subsection-title">Recent Sessions</div>
    <div class="stats-table-wrap"><table class="stats-table"><thead><tr><th>Date</th><th>Shots</th><th>Carry</th><th>Smash</th><th>Avg Face</th></tr></thead>
    <tbody>${last5.map(s=>`<tr><td>${s.date}</td><td>${s.n}</td><td>${fmt(s.carry,1)}m</td><td>${fmt(s.smash,2)}</td><td>${s.face!=null?(s.face>0?'+':'')+fmt(s.face,1)+'°':'–'}</td></tr>`).join('')}</tbody></table></div>`:''}
    ${clubTableHtml}`;
}

// ── Rule of 12 helper ──────────────────────────────────────────────────────
const RULE_OF_12 = {
  '7i':[1,5],'7 iron':[1,5],'7iron':[1,5],
  '8i':[1,4],'8 iron':[1,4],
  '9i':[1,3],'9 iron':[1,3],
  'pw':[1,2],'pitching wedge':[1,2],
  'sw':[1,1],'sand wedge':[1,1],
  '58':[1,1],'58°':[1,1],'58 degree':[1,1],
};
function getR12(club,distM){
  if(!club||!distM)return null;
  const key=club.toLowerCase().trim();
  const ratio=Object.entries(RULE_OF_12).find(([k])=>key.includes(k.replace('i','')))?.[1]
    ||RULE_OF_12[key];
  if(!ratio)return null;
  const total=ratio[0]+ratio[1];
  const carry=(distM*ratio[0]/total).toFixed(1);
  const roll=(distM*ratio[1]/total).toFixed(1);
  return{carry,roll,ratio:`1:${ratio[1]}`};
}
function updateR12(){
  const club=document.getElementById('chip-club')?.value;
  const dist=parseFloat(document.getElementById('chip-distance')?.value);
  const el=document.getElementById('chip-r12');
  if(!el)return;
  const r=getR12(club,dist);
  if(r){
    el.textContent=`${club.toUpperCase()} Rule of 12 (${r.ratio}): land ${r.carry}m, roll ${r.roll}m`;
    el.style.display='block';
  }else{
    el.style.display='none';
  }
}

// ── Bucket counter ─────────────────────────────────────────────────────────
function updateBucketCounter(){
  const att=parseInt(document.getElementById('chip-attempts')?.value)||0;
  const used=['chip-in1','chip-in2','chip-in3','chip-out3']
    .reduce((s,id)=>s+(parseInt(document.getElementById(id)?.value)||0),0);
  const el=document.getElementById('chip-bucket-count');
  if(!el)return;
  if(!att){el.textContent='';el.className='bucket-counter';return;}
  const over=used>att;
  el.textContent=over?`${used} assigned — over by ${used-att}`:`${used} of ${att} assigned`;
  el.className='bucket-counter'+(over?' bucket-over':used===att?' bucket-full':'');
}

// ── S1: Chipping with trend chart ──────────────────────────────────────────
async function loadChippingSummary(){
  const el=document.getElementById('stats-chipping-summary');
  const listEl=document.getElementById('stats-chipping-list');
  if(!el)return;
  const{data,error}=await sb.from('chipping_sessions').select('id,session_date,distance_m,club,attempts,success_target,inside_1m,between_1_2m,between_2_3m,outside_3m,notes,created_at').eq('user_id',_currentUserId).order('session_date',{ascending:false}).order('created_at',{ascending:false}).limit(100);
  if(error){el.innerHTML=`<div class="stats-error">${escapeHtml(error.message)}</div>`;return;}
  chippingCache=data||[];
  if(!data?.length){el.innerHTML='<div class="stats-empty">No chipping data yet.</div>';const cw=document.getElementById('chipping-chart-wrap');if(cw)cw.style.display='none';if(listEl)listEl.innerHTML='';return;}
  const att=sum(data.map(x=>x.attempts));
  const i1m=sum(data.map(x=>x.inside_1m));
  const i2m=sum(data.map(x=>(x.inside_1m||0)+(x.between_1_2m||0)));
  const i3m=sum(data.map(x=>(x.inside_1m||0)+(x.between_1_2m||0)+(x.between_2_3m||0)));

  // Recent form: last 5 sessions vs all-time
  const recent=data.slice(0,5);
  const recentAtt=sum(recent.map(x=>x.attempts));
  const recentI2m=sum(recent.map(x=>(x.inside_1m||0)+(x.between_1_2m||0)));
  const recentPctVal=recentAtt?recentI2m/recentAtt*100:null;
  const allPctVal=att?i2m/att*100:null;
  const formArrow=recentPctVal!=null&&allPctVal!=null?(recentPctVal>allPctVal+3?'↑ ':recentPctVal<allPctVal-3?'↓ ':'→ '):'';
  const formCol=formArrow==='↑ '?'var(--green)':formArrow==='↓ '?'var(--red)':'var(--text2)';

  // Streak: consecutive sessions ≥75% inside 2m (most recent first)
  const chipSorted=[...data].sort((a,b)=>new Date(b.session_date)-new Date(a.session_date));
  let chipStreak=0;
  for(const r of chipSorted){const i2=(r.inside_1m||0)+(r.between_1_2m||0);if(r.attempts&&i2/r.attempts*100>=75)chipStreak++;else break;}
  const in2Pct=att?i2m/att*100:null;
  const in2Cls=in2Pct!=null?(in2Pct>=75?'kpi-tile-green':in2Pct>=55?'kpi-tile-amber':'kpi-tile-red'):'kpi-tile-highlight';

  // By-distance breakdown
  const byDist={};
  data.forEach(r=>{
    const d=r.distance_m!=null?Math.round(r.distance_m)+'m':'?';
    if(!byDist[d])byDist[d]={sessions:0,attempts:0,in2m:0,in1m:0};
    byDist[d].sessions++;byDist[d].attempts+=r.attempts||0;
    byDist[d].in2m+=(r.inside_1m||0)+(r.between_1_2m||0);
    byDist[d].in1m+=r.inside_1m||0;
  });
  const distKeys=Object.keys(byDist).sort((a,b)=>parseFloat(a)-parseFloat(b));
  const distHtml=distKeys.length>1?`<div class="stats-subsection-title">By Distance</div>
    <div class="putt-dist-grid">${distKeys.map(d=>{const v=byDist[d];const r=v.attempts?v.in2m/v.attempts*100:0;const cls=r>=75?'putt-dist-highlight':'';return`<div class="putt-dist-card ${cls}"><div class="putt-dist-label">${d}</div><div class="putt-dist-rate">${pct(v.in2m,v.attempts)}</div><div class="putt-dist-sub">inside 2m · ${v.sessions}s</div></div>`;}).join('')}</div>`:'';

  el.innerHTML=`<div class="stats-kpi-band">
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${data.length}</div><div class="stats-kpi-tile-label">Sessions</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${att}</div><div class="stats-kpi-tile-label">Attempts</div></div>
    <div class="stats-kpi-tile ${in2Cls}"><div class="stats-kpi-tile-val">${pct(i2m,att)}</div><div class="stats-kpi-tile-label">Inside 2m</div><div class="stats-kpi-tile-sub">target 75%</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${pct(i1m,att)}</div><div class="stats-kpi-tile-label">Inside 1m</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${pct(i3m,att)}</div><div class="stats-kpi-tile-label">Inside 3m</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val" style="color:${formCol}">${formArrow}${recentPctVal!=null?recentPctVal.toFixed(0)+'%':'–'}</div><div class="stats-kpi-tile-label">Last 5 sess</div></div>
    <div class="stats-kpi-tile${chipStreak>=3?' kpi-tile-green':''}"><div class="stats-kpi-tile-val">${chipStreak>0?chipStreak+(chipStreak>=3?' 🔥':''):'0'}</div><div class="stats-kpi-tile-label">Streak</div><div class="stats-kpi-tile-sub">≥75% inside 2m</div></div>
  </div>
  ${distHtml}`;
  const cw=document.getElementById('chipping-chart-wrap');
  if(cw){cw.style.display='block';requestAnimationFrame(()=>drawChippingTrend(data));}
  if(listEl)listEl.innerHTML=`<div class="stats-table-wrap"><table class="stats-table">
    <thead><tr><th>Date</th><th>Club</th><th>Dist</th><th>Att</th><th>&lt;1m</th><th>1-2m</th><th>2-3m</th><th>&gt;3m</th><th></th></tr></thead>
    <tbody>${data.slice(0,15).map(r=>`<tr>
      <td>${escapeHtml(r.session_date)}</td><td>${escapeHtml(r.club)}</td><td>${fmt(r.distance_m,1)}m</td><td>${r.attempts}</td>
      <td>${r.inside_1m||0}</td><td>${r.between_1_2m||0}</td><td>${r.between_2_3m||0}</td><td>${r.outside_3m||0}</td>
      <td><div class="inline-actions"><button onclick="startEditChippingSession('${r.id}')">Edit</button><button onclick="deleteChippingSession('${r.id}')">✕</button></div></td>
    </tr>${r.notes?`<tr><td colspan="9" class="notes-row">${escapeHtml(r.notes)}</td></tr>`:''}`).join('')}</tbody></table></div>`;
}

function drawChippingTrend(data){
  const canvas=document.getElementById('chipping-trend-canvas');if(!canvas)return;
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
  const{data,error}=await sb.from('putting_sessions').select('id,session_date,distance_m,holed,total,notes,created_at').eq('user_id',_currentUserId).order('session_date',{ascending:false}).order('created_at',{ascending:false}).limit(100);
  if(error){el.innerHTML=`<div class="stats-error">${escapeHtml(error.message)}</div>`;return;}
  puttingCache=data||[];
  if(!data?.length){el.innerHTML='<div class="stats-empty">No putting data yet.</div>';const pw=document.getElementById('putting-chart-wrap');if(pw)pw.style.display='none';if(listEl)listEl.innerHTML='';return;}
  const holed=sum(data.map(x=>x.holed)),total=sum(data.map(x=>x.total));

  // Separate short putts (≤1.5m) for KPI tracking
  const shortPutts=data.filter(r=>r.distance_m<=1.5);
  const shortHoled=sum(shortPutts.map(x=>x.holed));
  const shortTotal=sum(shortPutts.map(x=>x.total));
  const shortPct=shortTotal?(shortHoled/shortTotal*100).toFixed(0)+'%':'–';
  const shortRate=shortTotal?shortHoled/shortTotal*100:null;

  // Recent form: last 5 short-putt sessions vs all-time
  const recentShort=shortPutts.slice(0,5);
  const recH=sum(recentShort.map(x=>x.holed)),recT=sum(recentShort.map(x=>x.total));
  const recRate=recT?recH/recT*100:null;
  const formArrow=recRate!=null&&shortRate!=null?(recRate>shortRate+3?'↑ ':recRate<shortRate-3?'↓ ':'→ '):'';
  const formCol=formArrow==='↑ '?'var(--green)':formArrow==='↓ '?'var(--red)':'var(--text2)';

  // Goal tracking: how many sessions ≥ 85%
  const goalsHit=shortPutts.filter(r=>r.total>0&&r.holed/r.total>=0.85).length;
  const goalStr=shortPutts.length?`${goalsHit}/${shortPutts.length}`:'–';

  // Streak: consecutive 1m sessions ≥ 85%
  const puttSorted=[...shortPutts].sort((a,b)=>new Date(b.session_date)-new Date(a.session_date));
  let puttStreak=0;
  for(const r of puttSorted){if(r.total>0&&r.holed/r.total>=0.85)puttStreak++;else break;}
  const make1mCls=shortRate!=null?(shortRate>=85?'kpi-tile-green':shortRate>=70?'kpi-tile-amber':'kpi-tile-red'):'kpi-tile-highlight';

  const byDist={};data.forEach(r=>{const d=fmt(r.distance_m,1);if(!byDist[d])byDist[d]={holed:0,total:0};byDist[d].holed+=r.holed||0;byDist[d].total+=r.total||0;});
  el.innerHTML=`<div class="stats-kpi-band">
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${data.length}</div><div class="stats-kpi-tile-label">Sessions</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${total}</div><div class="stats-kpi-tile-label">Total Putts</div></div>
    <div class="stats-kpi-tile ${make1mCls}"><div class="stats-kpi-tile-val">${shortPct}</div><div class="stats-kpi-tile-label">1m make rate</div><div class="stats-kpi-tile-sub">target 85%</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val" style="color:${formCol}">${formArrow}${recRate!=null?recRate.toFixed(0)+'%':'–'}</div><div class="stats-kpi-tile-label">Last 5 sess</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${goalStr}</div><div class="stats-kpi-tile-label">≥85% sessions</div></div>
    <div class="stats-kpi-tile${puttStreak>=3?' kpi-tile-green':''}"><div class="stats-kpi-tile-val">${puttStreak>0?puttStreak+(puttStreak>=3?' 🔥':''):'0'}</div><div class="stats-kpi-tile-label">Streak</div><div class="stats-kpi-tile-sub">≥85% make rate</div></div>
    <div class="stats-kpi-tile"><div class="stats-kpi-tile-val">${pct(holed,total)}</div><div class="stats-kpi-tile-label">All-dist rate</div></div>
  </div>
  ${Object.keys(byDist).length>1?`<div class="stats-subsection-title">By Distance</div><div class="putt-dist-grid">${Object.entries(byDist).sort((a,b)=>parseFloat(a[0])-parseFloat(b[0])).map(([d,v])=>{const r=v.total?v.holed/v.total*100:0;const cls=parseFloat(d)<=1.5?'putt-dist-highlight':'';return`<div class="putt-dist-card ${cls}"><div class="putt-dist-label">${d}m${parseFloat(d)<=1.5?' ★':''}</div><div class="putt-dist-rate">${pct(v.holed,v.total)}</div><div class="putt-dist-sub">${v.holed}/${v.total}</div></div>`;}).join('')}</div>`:''}`;
  const pw=document.getElementById('putting-chart-wrap');
  if(pw){pw.style.display='block';requestAnimationFrame(()=>drawPuttingTrend(data));}
  if(listEl)listEl.innerHTML=`<div class="stats-table-wrap"><table class="stats-table">
    <thead><tr><th>Date</th><th>Dist</th><th>Holed</th><th>Total</th><th>Rate</th><th></th></tr></thead>
    <tbody>${data.slice(0,15).map(r=>`<tr>
      <td>${escapeHtml(r.session_date)}</td><td>${fmt(r.distance_m,1)}m</td><td>${r.holed}</td><td>${r.total}</td><td>${pct(r.holed,r.total)}</td>
      <td><div class="inline-actions"><button onclick="startEditPuttingSession('${r.id}')">Edit</button><button onclick="deletePuttingSession('${r.id}')">✕</button></div></td>
    </tr>${r.notes?`<tr><td colspan="6" class="notes-row">${escapeHtml(r.notes)}</td></tr>`:''}`).join('')}</tbody></table></div>`;
}

function drawPuttingTrend(data){
  const canvas=document.getElementById('putting-trend-canvas');if(!canvas)return;
  const sorted=[...data].sort((a,b)=>new Date(a.session_date)-new Date(b.session_date));
  const shortOnly=sorted.filter(r=>r.distance_m<=1.5);
  const points=(shortOnly.length>=2?shortOnly:sorted).map(r=>({date:r.session_date,val:r.total?r.holed/r.total*100:null})).filter(p=>p.val!=null);
  drawSimpleTrendChart(canvas,points,shortOnly.length>=2?'1m make rate':'Make Rate','%',0,100,'#ffaa00');
}

// ── Shared mini trend chart ────────────────────────────────────────────────
function drawSimpleTrendChart(canvas,points,label,unit,yMin,yMax,color){
  if(!canvas||points.length<2)return;
  const dpr=Math.min(window.devicePixelRatio||2,3);
  const w=canvas.parentElement?.clientWidth||340,h=130;
  canvas.width=w*dpr;canvas.height=h*dpr;
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);

  const light=document.body.classList.contains('light-theme');
  const gridClr =light?'rgba(0,0,0,0.08)' :'rgba(255,255,255,0.05)';
  const axisClr =light?'#5a5550'           :'#4e5660';
  const titleClr=light?'#1a1916'           :'#f0ede8';

  const values=points.map(p=>p.val);
  const dates =points.map(p=>p.date);
  const pad={t:24,r:18,b:30,l:44};
  const cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  const dataMin=Math.min(...values),dataMax=Math.max(...values);
  const rangeMin=Math.min(yMin,dataMin-5),rangeMax=Math.max(yMax,dataMax+5);
  const px=i=>pad.l+(i/(values.length-1))*cw;
  const py=v=>pad.t+ch-((v-rangeMin)/(rangeMax-rangeMin))*ch;

  // Smooth catmull-rom helper
  function smLine(xs,ys){const n=xs.length;for(let i=0;i<n-1;i++){const x0=xs[Math.max(0,i-1)],y0=ys[Math.max(0,i-1)],x1=xs[i],y1=ys[i],x2=xs[i+1],y2=ys[i+1],x3=xs[Math.min(n-1,i+2)],y3=ys[Math.min(n-1,i+2)];ctx.bezierCurveTo(x1+(x2-x0)/6,y1+(y2-y0)/6,x2-(x3-x1)/6,y2-(y3-y1)/6,x2,y2);}}

  // Grid lines + y-axis labels
  ctx.font="9px 'DM Mono',monospace";ctx.fillStyle=axisClr;ctx.textAlign='right';
  for(let i=0;i<=3;i++){
    const y=pad.t+(ch/3)*i,val=rangeMax-((rangeMax-rangeMin)/3)*i;
    ctx.strokeStyle=gridClr;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
    ctx.fillText(val.toFixed(0)+unit,pad.l-4,y+3);
  }

  const xs=values.map((_,i)=>px(i)),ys=values.map(v=>py(v));

  // Fill area
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
  grad.addColorStop(0,color+'44');grad.addColorStop(0.6,color+'18');grad.addColorStop(1,color+'00');
  ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(xs[0],ys[0]);smLine(xs,ys);
  ctx.lineTo(xs[xs.length-1],pad.t+ch);ctx.lineTo(xs[0],pad.t+ch);ctx.closePath();ctx.fill();

  // Main line
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(xs[0],ys[0]);smLine(xs,ys);ctx.stroke();

  // Raw dots (small, subdued)
  ctx.fillStyle=color;
  values.forEach((_,i)=>{ctx.globalAlpha=0.5;ctx.beginPath();ctx.arc(xs[i],ys[i],2.5,0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha=1;

  // Trend line
  const n=values.length,sX=values.reduce((_,__,i)=>_+i,0),sY=values.reduce((a,b)=>a+b,0);
  const sXY=values.reduce((a,v,i)=>a+i*v,0),sX2=values.reduce((a,_,i)=>a+i*i,0);
  const slope=(n*sXY-sX*sY)/(n*sX2-sX*sX),intercept=(sY-slope*sX)/n;
  const tCol=slope>0.1?'#00d68f':slope<-0.1?'#ff4d4d':'#8a9099';
  ctx.strokeStyle=tCol;ctx.lineWidth=1.5;ctx.globalAlpha=0.55;ctx.setLineDash([6,4]);
  ctx.beginPath();ctx.moveTo(px(0),py(intercept));ctx.lineTo(px(n-1),py(slope*(n-1)+intercept));ctx.stroke();
  ctx.setLineDash([]);ctx.globalAlpha=1;

  // Last-value highlighted dot
  const lx=xs[xs.length-1],ly=ys[ys.length-1],lv=values[values.length-1];
  ctx.shadowColor=color;ctx.shadowBlur=8;
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(lx,ly,5,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
  ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(lx,ly,2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=color;ctx.font="700 9px 'DM Mono',monospace";ctx.textAlign='right';
  ctx.fillText(lv.toFixed(1)+unit,lx-8,ly-6);

  // Title + trend delta (top row)
  ctx.fillStyle=titleClr;ctx.font="700 10px 'Barlow Condensed',sans-serif";ctx.textAlign='left';
  ctx.fillText(label,pad.l,pad.t-8);
  const diff=slope*(n-1),arrow=slope>0.1?'↑':slope<-0.1?'↓':'→';
  ctx.fillStyle=tCol;ctx.textAlign='right';ctx.font="700 10px 'Barlow Condensed',sans-serif";
  ctx.fillText(`${arrow} ${diff>0?'+':''}${diff.toFixed(1)}${unit}`,w-pad.r,pad.t-8);

  // X-axis date labels
  ctx.fillStyle=axisClr;ctx.font="9px 'DM Mono',monospace";ctx.textAlign='center';
  const step=Math.max(1,Math.floor(dates.length/4));
  dates.forEach((d,i)=>{if(i%step===0||i===dates.length-1)ctx.fillText(d.slice(5),px(i),pad.t+ch+18);});
}

// ── Clubs overview ─────────────────────────────────────────────────────────
let _bagAllClubs=[],_bagGrouped={},_bagExpandedKeys=new Set(),_bagShowInactive=false;
window.toggleBagInactive=function(v){_bagShowInactive=v;renderBagCards();};
window.toggleBagCard=function(k){_bagExpandedKeys.has(k)?_bagExpandedKeys.delete(k):_bagExpandedKeys.add(k);renderBagCards();};

function renderBagCards(){
  const el=document.getElementById('clubs-overview');if(!el)return;
  const BAG_ORDER=['driver','3w','5w','4','5','6','7','8','9','pw','sw','58','putter'];
  const visible=[..._bagAllClubs]
    .filter(c=>_bagShowInactive||c.is_active)
    .sort((a,b)=>{const ai=BAG_ORDER.indexOf(a.club_key),bi=BAG_ORDER.indexOf(b.club_key);return(ai===-1?99:ai)-(bi===-1?99:bi);});
  if(!visible.length){
    el.innerHTML='<div class="bag-toolbar"><label class="bag-toggle-label"><input type="checkbox" class="bag-toggle-input"'+(_bagShowInactive?' checked':'')+'onchange="toggleBagInactive(this.checked)"> Show inactive clubs</label></div><div class="stats-empty">'+(_bagShowInactive?'No clubs found.':'No active clubs. Enable "Show inactive clubs" to see all.')+'</div>';
    return;
  }
  const cards=visible.map(row=>{
    const shots=_bagGrouped[row.club_key]||[];
    const carries=shots.map(s=>s.carry).filter(Boolean);
    const avgC=avg(carries),carrySD=stdDev(carries);
    // Trim top/bottom 10 % to remove outlier shanks from the range display
    const sortedC=[...carries].sort((a,b)=>a-b);
    const trimN=sortedC.length>=10?Math.round(sortedC.length*0.1):sortedC.length>=5?1:0;
    const trimmedC=sortedC.slice(trimN,sortedC.length-trimN||undefined);
    const carryMin=trimmedC.length?Math.round(trimmedC[0]):null;
    const carryMax=trimmedC.length?Math.round(trimmedC[trimmedC.length-1]):null;
    const sides=shots.map(s=>s.side).filter(x=>x!=null),avgSide=avg(sides);
    const miss=!avgSide?'–':avgSide>5?'Right':avgSide<-5?'Left':'Straight';
    const n=shots.length;
    const conf=n>=15?'High':n>=5?'Medium':n>0?'Low':'–';
    const playable=sides.length?Math.round(sides.filter(x=>Math.abs(x)<=15).length/sides.length*100)+'%':'–';
    const avgSmash=avg(shots.map(s=>s.smash_factor).filter(Boolean));
    const avgBall=avg(shots.map(s=>s.ball_speed).filter(Boolean));
    const avgFace=avg(shots.map(s=>s.face_angle).filter(Boolean));
    const avgPath=avg(shots.map(s=>s.club_path).filter(Boolean));
    const f2p=(avgFace!=null&&avgPath!=null)?avgFace-avgPath:null;
    const expanded=_bagExpandedKeys.has(row.club_key);
    const ocShots=_bagOnCourseGrouped[row.club_key]||[];
    const ocDists=ocShots.map(s=>s.distance_m).filter(x=>x!=null&&x>0);
    const WEDGE_PUTTER_KEYS=new Set(['pw','sw','aw','lw','58','putter']);
    const canFilterMishits=avgC!=null&&!WEDGE_PUTTER_KEYS.has(row.club_key?.toLowerCase());
    const mishitThreshold=canFilterMishits?avgC*0.6:null;
    const ocCleanDists=mishitThreshold!=null?ocDists.filter(d=>d>=mishitThreshold):ocDists;
    const ocMishitCount=mishitThreshold!=null?ocDists.length-ocCleanDists.length:null;
    const ocAvgDist=ocCleanDists.length>=2?Math.round(ocCleanDists.reduce((a,b)=>a+b,0)/ocCleanDists.length):(ocDists.length>=3?Math.round(ocDists.reduce((a,b)=>a+b,0)/ocDists.length):null);
    const ocMishitRate=(ocMishitCount!=null&&ocDists.length>=3)?Math.round(ocMishitCount/ocDists.length*100):null;
    const ocGap=ocAvgDist!=null&&avgC!=null?ocAvgDist-Math.round(avgC):null;
    const ocDirShots=ocShots.filter(s=>s.miss_direction);
    const ocLeft=ocDirShots.filter(s=>s.miss_direction?.includes('left')).length;
    const ocRight=ocDirShots.filter(s=>s.miss_direction?.includes('right')).length;
    const ocMissDir=ocDirShots.length>=3?(ocLeft>ocRight?'Left':ocRight>ocLeft?'Right':'Straight'):null;
    const ocDistTagged=ocShots.filter(s=>s.miss_direction&&(s.miss_direction.includes('short')||s.miss_direction.includes('long')));
    const ocShortCount=ocDistTagged.filter(s=>s.miss_direction.includes('short')).length;
    const ocLongCount=ocDistTagged.filter(s=>s.miss_direction.includes('long')).length;
    const ocDistTend=ocDistTagged.length>=3?(ocShortCount/ocDistTagged.length>=0.6?'Short':ocLongCount/ocDistTagged.length>=0.6?'Long':'On target'):null;
    const missChip=miss==='Straight'?'chip-ok':(miss==='–'?'chip-neutral':'chip-warn');
    const k=escapeHtml(row.club_key||'');
    return`<div class="bag-card${row.is_active?'':' bag-card-inactive'}${expanded?' bag-card-open':''}">
<div class="bag-card-head" onclick="toggleBagCard('${k}')">
  <div class="bag-card-info">
    <span class="bag-card-name">${escapeHtml(row.club_name)}${row.is_active?'':' <span class="bag-inactive-badge">Inactive</span>'}</span>
    <div class="bag-card-meta">${n>0
      ?`<span class="bag-card-carry">${Math.round(avgC)}m</span>${miss!=='–'?`<span class="bag-miss-chip ${missChip}">${miss}</span>`:''}<span class="bag-card-conf">${conf}</span>`
      :'<span class="bag-nodata-chip">No data</span>'
    }</div>
  </div>
  <span class="bag-card-chevron">${expanded?'▲':'▼'}</span>
</div>
${expanded?`<div class="bag-card-body">
  ${n>0?`<div class="bag-sections">
    <div class="bag-section"><div class="bag-sec-title">Distance</div>
      <div class="bag-stat-row"><span>Avg carry</span><strong>${Math.round(avgC)}m</strong></div>
      ${carrySD?`<div class="bag-stat-row"><span>Spread ±</span><strong>${fmt(carrySD)}m</strong></div>`:''}
      ${(carryMin!=null&&carryMax!=null&&carryMin!==carryMax)?`<div class="bag-stat-row"><span>Typical range</span><strong>${carryMin}–${carryMax}m</strong></div>`:''}
      ${ocAvgDist!=null?`<div class="bag-stat-row bag-stat-oncourse"><span>On course avg</span><strong>${ocAvgDist}m${ocGap!=null&&Math.abs(ocGap)>=5?` <span class="bag-oc-gap">(${ocGap>0?'+':''}${Math.round(ocGap)}m vs range)</span>`:''}</strong></div>`:''}
      ${ocMishitRate!=null?`<div class="bag-stat-row bag-stat-oncourse"><span>Mishit rate</span><strong>${ocMishitRate}% (${ocMishitCount}/${ocDists.length})</strong></div>`:''}
    </div>
    <div class="bag-section"><div class="bag-sec-title">Direction</div>
      <div class="bag-stat-row"><span>Avg side</span><strong>${avgSide!=null?fmt(avgSide)+'m':'–'}</strong></div>
      <div class="bag-stat-row"><span>Main miss</span><strong>${miss}</strong></div>
      <div class="bag-stat-row"><span>Playable</span><strong>${playable}</strong></div>
      ${ocMissDir!=null?`<div class="bag-stat-row bag-stat-oncourse"><span>On-course miss</span><strong>${ocMissDir}</strong></div>`:''}
      ${ocDistTend!=null?`<div class="bag-stat-row bag-stat-oncourse"><span>On-course distance</span><strong>${ocDistTend}</strong></div>`:''}
    </div>
    <div class="bag-section"><div class="bag-sec-title">Contact</div>
      <div class="bag-stat-row"><span>Smash</span><strong>${avgSmash?fmt(avgSmash,2):'–'}</strong></div>
      <div class="bag-stat-row"><span>Ball speed</span><strong>${avgBall?Math.round(avgBall)+'m/s':'–'}</strong></div>
      <div class="bag-stat-row"><span>Confidence</span><strong>${conf} (${n} shots)</strong></div>
    </div>
    ${(avgFace!=null||avgPath!=null)?`<div class="bag-section"><div class="bag-sec-title">Swing cause</div>
      ${avgFace!=null?`<div class="bag-stat-row"><span>Face angle</span><strong>${fmt(avgFace,1)}°</strong></div>`:''}
      ${avgPath!=null?`<div class="bag-stat-row"><span>Club path</span><strong>${fmt(avgPath,1)}°</strong></div>`:''}
      ${f2p!=null?`<div class="bag-stat-row"><span>Face-to-path</span><strong>${fmt(f2p,1)}°</strong></div>`:''}
    </div>`:''}
  </div>`:`<div class="bag-nodata-msg">No shots yet. Import TrackMan data or log practice.</div>`}
  <div class="bag-actions">
    <button class="bag-action-btn" onclick="event.stopPropagation();showPage('coach')">Open Coach</button>
    <button class="bag-action-btn" onclick="event.stopPropagation();openClubInAnalysis('${k}')">TrackMan shots</button>
    <button class="bag-action-btn" onclick="event.stopPropagation();showPage('stats')">Log practice</button>
  </div>
</div>`:''}
</div>`;
  }).join('');
  // Distance map — clubs with ≥2 carry readings sorted longest to shortest
  const gapData = visible
    .map(row => {
      const shots = _bagGrouped[row.club_key] || [];
      const carries = shots.map(s => s.carry).filter(Boolean);
      const ac = avg(carries);
      return (ac != null && carries.length >= 2)
        ? { name: row.club_name, key: row.club_key, ac: Math.round(ac) }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.ac - a.ac);

  let gapSectionHtml = '';
  if (gapData.length >= 2) {
    const gapRows = gapData.map((d, i) => {
      const gap = i > 0 ? gapData[i - 1].ac - d.ac : null;
      const gapChip = gap == null
        ? '<span class="bag-gap-chip bag-gap-first">—</span>'
        : gap > 15
          ? `<span class="bag-gap-chip bag-gap-wide">${gap}m</span>`
          : `<span class="bag-gap-chip">${gap}m</span>`;
      return `<div class="bag-gap-row">${gapChip}<span class="bag-gap-club">${escapeHtml(d.name)}</span><span class="bag-gap-carry">${d.ac}m</span></div>`;
    }).join('');
    gapSectionHtml = `<details class="bag-gap-section"><summary class="bag-gap-title">Distance map <span class="bag-gap-count">${gapData.length} clubs</span></summary><div class="bag-gap-rows">${gapRows}</div></details>`;
  }

  el.innerHTML=`<div class="bag-toolbar"><label class="bag-toggle-label"><input type="checkbox" class="bag-toggle-input"${_bagShowInactive?' checked':''} onchange="toggleBagInactive(this.checked)"> Show inactive clubs</label></div>${gapSectionHtml}<div class="bag-cards">${cards}</div>`;
}

async function loadClubsOverview(){
  const el=document.getElementById('clubs-overview');if(!el)return;
  if(!_currentUserId){el.innerHTML='<div class="stats-empty">Log in to see your bag.</div>';return;}
  el.innerHTML='<div class="stats-loading">Loading…</div>';
  const CA=window.clubAliases;await CA.loadAliases();
  const[clubsRes,shotsRes,roundShotsRes]=await Promise.all([
    sb.from('clubs').select('club_key,club_name,club_type,brand,model,loft,is_active').eq('user_id',_currentUserId).order('club_name'),
    sb.from('trackman_shots').select('club,carry,smash_factor,ball_speed,spin_rate,launch_angle,face_angle,club_path,side,is_full_shot,exclude_from_progress').eq('user_id',_currentUserId).limit(2000),
    sb.from('round_shots').select('club,distance_m,miss_direction').eq('user_id',_currentUserId).limit(2000)
  ]);
  const hasAliases=CA.CLUB_DEFINITIONS.some(d=>CA.getRawNamesForKey(d.key).length>0);
  if(!hasAliases){
    el.innerHTML=`<div class="clubs-onboarding">
      <div class="clubs-onboarding-title">Set up your bag</div>
      <div class="clubs-onboarding-steps">
        <div class="clubs-onboarding-step"><span class="onboarding-num">1</span><span>Hit balls on the TrackMan simulator</span></div>
        <div class="clubs-onboarding-step"><span class="onboarding-num">2</span><span>Come back to this page</span></div>
        <div class="clubs-onboarding-step"><span class="onboarding-num">3</span><span>Tap More → Club aliases to map TrackMan names to your clubs</span></div>
      </div>
    </div>`;
    const am=document.getElementById('alias-manager');
    if(am&&typeof renderAliasManager==='function')renderAliasManager();
    return;
  }
  if(clubsRes.error||!clubsRes.data?.length){
    el.innerHTML='<div class="stats-empty">No clubs found.</div>';
    const am=document.getElementById('alias-manager');if(am&&typeof renderAliasManager==='function')renderAliasManager();
    return;
  }
  const progressShots=(shotsRes.data||[]).filter(s=>s.is_full_shot!==false&&s.exclude_from_progress!==true);
  _bagAllClubs=clubsRes.data;
  _bagGrouped=CA.groupShotsByClub(progressShots);
  const _normClub=window.normaliseRoundClub||(()=>null);
  _bagOnCourseGrouped={};
  (roundShotsRes.data||[]).filter(s=>s.distance_m!=null&&s.distance_m>2&&(s.club||'').toLowerCase()!=='putter').forEach(s=>{
    const key=_normClub(s.club);if(!key)return;
    if(!_bagOnCourseGrouped[key])_bagOnCourseGrouped[key]=[];
    _bagOnCourseGrouped[key].push(s);
  });
  _bagExpandedKeys=new Set();
  _bagShowInactive=false;
  renderBagCards();
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
  const{error}=await sb.from('chipping_sessions').update({session_date,distance_m,club,attempts,success_target,inside_1m,between_1_2m,between_2_3m,outside_3m,notes}).eq('id',editingChipId).eq('user_id',_currentUserId);
  if(error){msg(error.message,true);return;}
  msg('Updated');cancelEditChippingSession();await loadChippingSummary();
}
function startEditChippingSession(id){
  const r=chippingCache.find(x=>x.id===id);if(!r)return;
  editingChipId=id;
  document.getElementById('chip-date').value=r.session_date||'';
  document.getElementById('chip-distance').value=r.distance_m??'';
  document.getElementById('chip-club').value=r.club||'';
  document.getElementById('chip-attempts').value=r.attempts??'';
  document.getElementById('chip-in1').value=r.inside_1m??0;
  document.getElementById('chip-in2').value=r.between_1_2m??0;
  document.getElementById('chip-in3').value=r.between_2_3m??0;
  document.getElementById('chip-out3').value=r.outside_3m??0;
  document.getElementById('chip-success').value=r.success_target??'';
  document.getElementById('chip-notes').value=r.notes||'';
  document.getElementById('add-chip-btn').style.display='none';
  document.getElementById('update-chip-btn').style.display='inline-block';
  document.getElementById('cancel-chip-edit-btn').style.display='inline-block';
  updateBucketCounter();updateR12();
  if(typeof openLogForm==='function')openLogForm('chip-form');
}
function cancelEditChippingSession(){editingChipId=null;clearChippingForm();document.getElementById('add-chip-btn').style.display='inline-block';document.getElementById('update-chip-btn').style.display='none';document.getElementById('cancel-chip-edit-btn').style.display='none';}
async function deleteChippingSession(id){if(!_currentUserId)return;const{error}=await sb.from('chipping_sessions').delete().eq('id',id).eq('user_id',_currentUserId);if(error){msg(error.message,true);return;}if(editingChipId===id)cancelEditChippingSession();msg('Deleted');await loadChippingSummary();}
function clearChippingForm(){
  ['chip-date','chip-distance','chip-club','chip-attempts','chip-in1','chip-in2','chip-in3','chip-out3','chip-success','chip-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  const bc=document.getElementById('chip-bucket-count');if(bc)bc.textContent='';
  const r12=document.getElementById('chip-r12');if(r12)r12.style.display='none';
}

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
  const{error}=await sb.from('putting_sessions').update({session_date,distance_m,holed,total,notes}).eq('id',editingPuttId).eq('user_id',_currentUserId);
  if(error){msg(error.message,true);return;}
  msg('Updated');cancelEditPuttingSession();await loadPuttingSummary();
}
function startEditPuttingSession(id){
  const r=puttingCache.find(x=>x.id===id);if(!r)return;
  editingPuttId=id;
  document.getElementById('putt-date').value=r.session_date||'';
  document.getElementById('putt-distance').value=r.distance_m??'';
  document.getElementById('putt-holed').value=r.holed??'';
  document.getElementById('putt-total').value=r.total??'';
  document.getElementById('putt-notes').value=r.notes||'';
  document.getElementById('add-putt-btn').style.display='none';
  document.getElementById('update-putt-btn').style.display='inline-block';
  document.getElementById('cancel-putt-edit-btn').style.display='inline-block';
  if(typeof openLogForm==='function')openLogForm('putt-form');
}
function cancelEditPuttingSession(){editingPuttId=null;clearPuttingForm();document.getElementById('add-putt-btn').style.display='inline-block';document.getElementById('update-putt-btn').style.display='none';document.getElementById('cancel-putt-edit-btn').style.display='none';}
async function deletePuttingSession(id){if(!_currentUserId)return;const{error}=await sb.from('putting_sessions').delete().eq('id',id).eq('user_id',_currentUserId);if(error){msg(error.message,true);return;}if(editingPuttId===id)cancelEditPuttingSession();msg('Deleted');await loadPuttingSummary();}
function clearPuttingForm(){['putt-date','putt-distance','putt-holed','putt-total','putt-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});}

// ── Progress section (More → Progress) ────────────────────────────────────
async function loadProgressSection(){
  const el=document.getElementById('more-section-body');
  if(!el)return;
  if(!_currentUserId){el.innerHTML='<div class="stats-login-note">Log in to see your progress.</div>';return;}
  el.innerHTML='<div class="stats-loading">Loading…</div>';
  const now=Date.now();
  const thirty=new Date(now-30*24*3600*1000).toISOString().slice(0,10);
  const sixty=new Date(now-60*24*3600*1000).toISOString().slice(0,10);
  try{
    // Current period (last 30 days) and previous period (days 30–60) fetched together
    const[tmRes,chipRes,puttRes,practiceRes,
          tmPrevRes,chipPrevRes,puttPrevRes,
          roundsRes,roundShotsDirRes]=await Promise.all([
      sb.from('trackman_shots').select('carry,side,smash_factor,face_angle,is_full_shot,exclude_from_progress,shot_time,created_at').eq('user_id',_currentUserId).gte('shot_time',thirty+'T00:00:00').order('shot_time',{ascending:false}).limit(500),
      sb.from('chipping_sessions').select('session_date,attempts,inside_1m,between_1_2m,outside_3m').eq('user_id',_currentUserId).gte('session_date',thirty).order('session_date',{ascending:false}),
      sb.from('putting_sessions').select('session_date,distance_m,holed,total').eq('user_id',_currentUserId).gte('session_date',thirty).order('session_date',{ascending:false}),
      sb.from('practice_sessions').select('session_date,practice_type').eq('user_id',_currentUserId).gte('session_date',thirty).order('session_date',{ascending:false}),
      // Previous period
      sb.from('trackman_shots').select('carry,side,smash_factor,face_angle,is_full_shot,exclude_from_progress').eq('user_id',_currentUserId).gte('shot_time',sixty+'T00:00:00').lt('shot_time',thirty+'T00:00:00').limit(500),
      sb.from('chipping_sessions').select('attempts,inside_1m,between_1_2m,outside_3m').eq('user_id',_currentUserId).gte('session_date',sixty).lt('session_date',thirty),
      sb.from('putting_sessions').select('distance_m,holed,total').eq('user_id',_currentUserId).gte('session_date',sixty).lt('session_date',thirty),
      // Rounds (graceful: tables may not exist yet)
      sb.from('rounds').select('id,round_date,total_strokes,total_putts').eq('user_id',_currentUserId).gte('round_date',thirty).order('round_date',{ascending:false}),
      sb.from('round_shots').select('round_id,hole,par,shot_number,lie,miss_direction').eq('user_id',_currentUserId).gte('created_at',thirty+'T00:00:00').limit(1000),
    ]);
    // ── Current period ──
    const tmShots=(tmRes.data||[]).filter(s=>s.is_full_shot!==false&&s.exclude_from_progress!==true);
    const tmDays=[...new Set(tmShots.map(s=>(s.shot_time||s.created_at)?.slice(0,10)).filter(Boolean))];
    const carries=tmShots.map(s=>s.carry).filter(Boolean);
    const sides=tmShots.map(s=>s.side).filter(s=>s!=null);
    const smashes=tmShots.map(s=>s.smash_factor).filter(Boolean);
    const faces=tmShots.map(s=>s.face_angle).filter(s=>s!=null);
    const avgCarry=avg(carries);
    const carrySD=stdDev(carries);
    const playablePct=sides.length?sides.filter(s=>Math.abs(s)<=20).length/sides.length*100:null;
    const avgSmash=avg(smashes);
    const avgFace=avg(faces);
    // Chipping
    const chips=chipRes.data||[];
    const chipAtt=sum(chips.map(x=>x.attempts));
    const chipIn2=sum(chips.map(x=>(x.inside_1m||0)+(x.between_1_2m||0)));
    const chipOut3=sum(chips.map(x=>x.outside_3m||0));
    const chipIn2Rate=chipAtt?chipIn2/chipAtt*100:null;
    const chipOut3Rate=chipAtt?chipOut3/chipAtt*100:null;
    // Putting
    const putts=puttRes.data||[];
    const shortPutts=putts.filter(p=>p.distance_m!=null&&p.distance_m<=2);
    const puttHoled=sum(shortPutts.map(x=>x.holed));
    const puttTotal=sum(shortPutts.map(x=>x.total));
    const puttMakeRate=puttTotal?puttHoled/puttTotal*100:null;
    // Practice
    const practiceOk=!practiceRes.error;
    const practiceSessions=practiceOk?(practiceRes.data||[]):[];
    const rangeSessions=practiceSessions.filter(s=>s.practice_type==='range');
    // Rounds
    const roundsOk=!roundsRes.error;
    const recentRounds=roundsOk?(roundsRes.data||[]):[];
    const roundShotsDirOk=!roundShotsDirRes.error;
    const roundShotsDir=roundShotsDirOk?(roundShotsDirRes.data||[]):[];
    // Days since last
    const allDates=[...tmDays,...chips.map(s=>s.session_date),...putts.map(s=>s.session_date),...practiceSessions.map(s=>s.session_date)].filter(Boolean).sort().reverse();
    const lastDate=allDates[0];
    const daysSince=lastDate?Math.floor((Date.now()-new Date(lastDate))/(24*3600*1000)):null;

    // ── Previous period ──
    const tmPrev=(tmPrevRes.data||[]).filter(s=>s.is_full_shot!==false&&s.exclude_from_progress!==true);
    const prevCarries=tmPrev.map(s=>s.carry).filter(Boolean);
    const prevSides=tmPrev.map(s=>s.side).filter(s=>s!=null);
    const prevSmashes=tmPrev.map(s=>s.smash_factor).filter(Boolean);
    const prevAvgCarry=avg(prevCarries);
    const prevCarrySD=stdDev(prevCarries);
    const prevPlayablePct=prevSides.length?prevSides.filter(s=>Math.abs(s)<=20).length/prevSides.length*100:null;
    const prevAvgSmash=avg(prevSmashes);
    const chipPrev=chipPrevRes.data||[];
    const prevChipAtt=sum(chipPrev.map(x=>x.attempts));
    const prevChipIn2=sum(chipPrev.map(x=>(x.inside_1m||0)+(x.between_1_2m||0)));
    const prevChipOut3=sum(chipPrev.map(x=>x.outside_3m||0));
    const prevChipIn2Rate=prevChipAtt?prevChipIn2/prevChipAtt*100:null;
    const prevChipOut3Rate=prevChipAtt?prevChipOut3/prevChipAtt*100:null;
    const puttPrev=puttPrevRes.data||[];
    const prevShortPutts=puttPrev.filter(p=>p.distance_m!=null&&p.distance_m<=2);
    const prevPuttHoled=sum(prevShortPutts.map(x=>x.holed));
    const prevPuttTotal=sum(prevShortPutts.map(x=>x.total));
    const prevPuttMakeRate=prevPuttTotal?prevPuttHoled/prevPuttTotal*100:null;
    const hasPrevTm=tmPrev.length>=5;
    const hasPrevChip=chipPrev.length>0;
    const hasPrevPutt=puttPrev.length>0;

    // ── Status helpers ──
    // Period-over-period: improveThr = delta needed for "Improved", stableThr = decline before "Needs attention"
    // hi=true means higher is better (carry, playable%), hi=false means lower is better (carrySD)
    function stDelta(curr,prev,hasPrev,improveThr,stableThr,hi=true){
      if(curr===null||curr===undefined)return null;
      if(!hasPrev||prev===null||prev===undefined)return'ok'; // no comparison data → neutral
      const d=hi?(curr-prev):(prev-curr); // positive d = improvement
      if(d>=improveThr)return'good';
      if(d>=-stableThr)return'ok';
      return'bad';
    }
    // Absolute fallback used for practice consistency metrics
    function st(val,good,bad,hi=true){if(val===null||val===undefined)return null;return hi?(val>=good?'good':val>=bad?'ok':'bad'):(val<=good?'good':val<=bad?'ok':'bad');}
    const SL={good:'✓ Improved',ok:'→ Stable',bad:'⚠ Needs attention'};
    function chip(s){if(!s)return'';return`<span class="progress-status progress-status-${s}">${SL[s]}</span>`;}

    // Delta display: +3m, −5%pts, etc. — green if improvement, red if decline
    function deltaStr(curr,prev,hasPrev,unit,decimals=0,hi=true){
      if(!hasPrev||curr==null||prev==null)return'';
      const d=curr-prev;
      const fmtD=fmt(Math.abs(d),decimals);
      if(fmtD==='0'||(decimals>0&&parseFloat(fmtD)===0))return'';
      const sign=d>0?'+':'−';
      const isGood=(d>0)===hi;
      return` <span class="progress-delta progress-delta-${isGood?'up':'dn'}">${sign}${fmtD}${unit}</span>`;
    }
    // row() accepts optional deltaHtml (raw HTML string, not escaped)
    function row(label,valStr,status,deltaHtml=''){return`<div class="progress-metric"><div class="progress-metric-left"><div class="progress-metric-label">${escapeHtml(label)}</div><div class="progress-metric-val">${escapeHtml(valStr)}${deltaHtml}</div></div>${chip(status)}</div>`;}

    const totalSG=chips.length+putts.length;
    const summaryHtml=`<div class="progress-summary-strip">
      <div class="progress-summary-item"><div class="progress-summary-val">${tmDays.length}</div><div class="progress-summary-label">TrackMan days</div></div>
      <div class="progress-summary-sep"></div>
      <div class="progress-summary-item"><div class="progress-summary-val">${totalSG}</div><div class="progress-summary-label">Short game logs</div></div>
      <div class="progress-summary-sep"></div>
      <div class="progress-summary-item"><div class="progress-summary-val">${daysSince===null?'–':daysSince===0?'Today':daysSince+'d'}</div><div class="progress-summary-label">Last session</div></div>
    </div>`;

    const periodNote=`<span class="progress-period-note">vs prev 30d</span>`;
    const tmHtml=tmShots.length>=5?`
      <div class="progress-group-label">TrackMan — last 30 days ${hasPrevTm?periodNote:''}</div>
      <div class="progress-card">
        ${row('Avg carry',avgCarry!=null?fmt(avgCarry,0)+'m':'–',stDelta(avgCarry,prevAvgCarry,hasPrevTm,3,3),deltaStr(avgCarry,prevAvgCarry,hasPrevTm,'m',0))}
        ${carrySD!=null?row('Carry consistency','±'+fmt(carrySD,0)+'m SD',stDelta(carrySD,prevCarrySD,hasPrevTm,2,2,false),deltaStr(carrySD,prevCarrySD,hasPrevTm,'m',0,false)):''}
        ${playablePct!=null?row('Playable shots',fmt(playablePct,0)+'%',stDelta(playablePct,prevPlayablePct,hasPrevTm,5,5),deltaStr(playablePct,prevPlayablePct,hasPrevTm,'%pts',0)):''}
        ${avgSmash!=null?row('Smash factor',fmt(avgSmash,2),stDelta(avgSmash,prevAvgSmash,hasPrevTm,0.02,0.02),deltaStr(avgSmash,prevAvgSmash,hasPrevTm,'',2)):''}
        ${avgFace!=null?row('Face angle avg',(avgFace>0?'+':'')+fmt(avgFace,1)+'°',st(Math.abs(avgFace),2,4,false)):''}
      </div>`
      :`<div class="progress-group-label">TrackMan</div><div class="progress-empty">No TrackMan shots in the last 30 days.</div>`;

    const chipHtml=chips.length?`
      <div class="progress-group-label">Chipping — last 30 days ${hasPrevChip?periodNote:''}</div>
      <div class="progress-card">
        ${row('Sessions',chips.length+' sessions, '+chipAtt+' attempts',null)}
        ${chipIn2Rate!=null?row('Inside 2m',fmt(chipIn2Rate,0)+'%',stDelta(chipIn2Rate,prevChipIn2Rate,hasPrevChip,5,5),deltaStr(chipIn2Rate,prevChipIn2Rate,hasPrevChip,'%pts',0)):''}
        ${chipOut3Rate!=null?row('Outside 3m',fmt(chipOut3Rate,0)+'%',stDelta(chipOut3Rate,prevChipOut3Rate,hasPrevChip,5,5,false),deltaStr(chipOut3Rate,prevChipOut3Rate,hasPrevChip,'%pts',0,false)):''}
      </div>`
      :`<div class="progress-group-label">Chipping</div><div class="progress-empty">No chipping sessions in the last 30 days.</div>`;

    const puttHtml=putts.length?`
      <div class="progress-group-label">Putting — last 30 days ${hasPrevPutt?periodNote:''}</div>
      <div class="progress-card">
        ${row('Sessions',putts.length+' sessions',null)}
        ${puttMakeRate!=null?row('Short putt make rate (≤2m)',fmt(puttMakeRate,0)+'%',stDelta(puttMakeRate,prevPuttMakeRate,hasPrevPutt,5,5),deltaStr(puttMakeRate,prevPuttMakeRate,hasPrevPutt,'%pts',0)):''}
      </div>`
      :`<div class="progress-group-label">Putting</div><div class="progress-empty">No putting sessions in the last 30 days.</div>`;

    const practiceHtml=`
      <div class="progress-group-label">Practice consistency</div>
      <div class="progress-card">
        ${row('TrackMan days this month',tmDays.length+' / 30 days',st(tmDays.length,4,2))}
        ${row('Short game sessions',totalSG+' sessions',st(totalSG,4,2))}
        ${practiceOk?row('Range sessions',rangeSessions.length+' sessions',null):''}
        ${daysSince!==null?row('Days since last session',daysSince===0?'Today':daysSince+'d ago',st(daysSince,7,14,false)):''}
      </div>`;

    // On-course rounds
    let roundsHtml;
    if(!roundsOk){
      roundsHtml='<div class="progress-group-label">On-course</div><div class="progress-empty">Run the latest migration to enable round tracking.</div>';
    }else if(!recentRounds.length){
      roundsHtml='<div class="progress-group-label">On-course</div><div class="progress-empty">Log a round to see on-course progress.</div>';
    }else{
      const rWithScore=recentRounds.filter(r=>r.total_strokes);
      const avgScore=rWithScore.length?Math.round(rWithScore.reduce((s,r)=>s+r.total_strokes,0)/rWithScore.length):null;
      const rWithPutts=recentRounds.filter(r=>r.total_putts);
      const avgPuttsRound=rWithPutts.length?fmt(rWithPutts.reduce((s,r)=>s+r.total_putts,0)/rWithPutts.length,1):null;
      const dirShots=roundShotsDir.filter(s=>s.miss_direction);
      const ocLeft=dirShots.filter(s=>s.miss_direction?.includes('left')).length;
      const ocRight=dirShots.filter(s=>s.miss_direction?.includes('right')).length;
      const ocTotal=dirShots.length;
      let ocMissNote=null;
      if(ocTotal>=5){
        const lp=ocLeft/ocTotal*100,rp=ocRight/ocTotal*100;
        const ocDir=lp>55?'left':rp>55?'right':null;
        if(ocDir){
          const tmDir=avgFace!=null?(avgFace>1?'right':avgFace<-1?'left':null):null;
          const match=tmDir&&tmDir===ocDir;
          ocMissNote=`Miss ${ocDir} on course${match?' — matches TrackMan pattern':tmDir?' — opposite to TrackMan':''}`;
        }else{ocMissNote='No clear miss pattern';}
      }
      const distTagged=roundShotsDir.filter(s=>s.miss_direction&&(s.miss_direction.includes('short')||s.miss_direction.includes('long')));
      const ocShortPct=distTagged.filter(s=>s.miss_direction.includes('short')).length;
      const ocLongPct=distTagged.filter(s=>s.miss_direction.includes('long')).length;
      let ocDistNote=null;
      if(distTagged.length>=5){
        const sp=ocShortPct/distTagged.length*100,lp=ocLongPct/distTagged.length*100;
        if(sp>=60)ocDistNote=`Tend to come up short (${Math.round(sp)}%)`;
        else if(lp>=60)ocDistNote=`Tend to overshoot (${Math.round(lp)}%)`;
      }
      // Par 3/4/5 breakdown from shot-level data
      const holeGroups={};
      roundShotsDir.forEach(s=>{
        if(!s.round_id||!s.hole)return;
        const k=`${s.round_id}:${s.hole}`;
        if(!holeGroups[k])holeGroups[k]={par:s.par,shots:[],total:0};
        holeGroups[k].total++;
        holeGroups[k].shots.push(s);
      });
      const parAgg={};
      const roughUD2={att:0,made:0},bunkerUD2={att:0,made:0};
      Object.values(holeGroups).forEach(({par,shots,total})=>{
        if(par){
          if(!parAgg[par])parAgg[par]={count:0,totalRel:0};
          parAgg[par].count++;parAgg[par].totalRel+=total-par;
        }
        const sorted=[...shots].sort((a,b)=>a.shot_number-b.shot_number);
        const lastRough=sorted.filter(s=>s.shot_number>1&&(s.lie||'').toLowerCase().includes('rough')).pop();
        const lastBunker=sorted.filter(s=>s.shot_number>1&&((s.lie||'').toLowerCase().includes('bunker')||(s.lie||'').toLowerCase().includes('sand'))).pop();
        if(lastRough){roughUD2.att++;if(total-lastRough.shot_number<=1)roughUD2.made++;}
        if(lastBunker){bunkerUD2.att++;if(total-lastBunker.shot_number<=1)bunkerUD2.made++;}
      });
      const parRows=[3,4,5].filter(p=>parAgg[p]?.count>=2).map(p=>{
        const g=parAgg[p];const rel=g.totalRel/g.count;
        return row(`Par ${p} avg`,`${rel>=0?'+':''}${rel.toFixed(1)} (${g.count} holes)`,null);
      }).join('');
      const udParts=[];
      if(roughUD2.att>=3)udParts.push(`Rough: ${roughUD2.made}/${roughUD2.att} (${Math.round(roughUD2.made/roughUD2.att*100)}%)`);
      if(bunkerUD2.att>=3)udParts.push(`Bunker: ${bunkerUD2.made}/${bunkerUD2.att} (${Math.round(bunkerUD2.made/bunkerUD2.att*100)}%)`);
      roundsHtml=`<div class="progress-group-label">On-course — last 30 days</div>
      <div class="progress-card">
        ${row('Rounds played',recentRounds.length+(recentRounds.length===1?' round':' rounds'),null)}
        ${avgScore!=null?row('Avg score',avgScore+' strokes',null):''}
        ${avgPuttsRound!=null?row('Avg putts per round',avgPuttsRound,null):''}
        ${parRows}
        ${ocMissNote!=null?row('On-course miss',ocMissNote,null):''}
        ${ocDistNote!=null?row('Distance tendency',ocDistNote,null):''}
        ${udParts.length?row('Up-and-down',udParts.join(' · '),null):''}
      </div>`;
    }

    el.innerHTML=summaryHtml+tmHtml+chipHtml+puttHtml+practiceHtml+roundsHtml;
  }catch(e){
    el.innerHTML='<div class="stats-error">Failed to load progress. Try again.</div>';
  }
}

// ── Practice sessions (range + course) ────────────────────────────────────
function _renderPracticeList(sessions,type){
  if(!sessions.length){
    const label=type==='range'?'range sessions':'course notes';
    return`<div class="stats-empty-small">No ${label} yet. Use the button above to add one.</div>`;
  }
  return sessions.slice(0,10).map(s=>{
    const title=s.title||(type==='range'?(s.club_key||'Range session'):'Course note');
    const sub=[s.focus_area,s.main_miss?'Miss: '+s.main_miss:null].filter(Boolean).join(' · ');
    const confStr=s.confidence?'★'.repeat(Math.min(s.confidence,5)):'';
    return`<div class="practice-session-row">
      <div class="practice-session-date">${escapeHtml(s.session_date||'')}</div>
      <div class="practice-session-title">${escapeHtml(title)}${confStr?`<span class="practice-session-conf">${confStr}</span>`:''}</div>
      ${sub?`<div class="practice-session-sub">${escapeHtml(sub)}</div>`:''}
      ${s.notes?`<div class="practice-session-notes">${escapeHtml(s.notes)}</div>`:''}
    </div>`;
  }).join('');
}

async function loadPracticeSessions(){
  if(!_currentUserId)return;
  const rangeEl=document.getElementById('stats-practice-range');
  const courseEl=document.getElementById('stats-practice-course');
  try{
    const{data,error}=await sb.from('practice_sessions')
      .select('id,practice_type,session_date,club_key,focus_area,balls,good_shots,main_miss,best_cue,confidence,title,notes')
      .eq('user_id',_currentUserId)
      .order('session_date',{ascending:false})
      .limit(50);
    if(error){
      _practiceSessionsAvailable=false;
      const migMsg='<div class="stats-empty-small">Run the latest migration to enable this feature.</div>';
      if(rangeEl)rangeEl.innerHTML=migMsg;
      if(courseEl)courseEl.innerHTML=migMsg;
      return;
    }
    _practiceSessionsAvailable=true;
    const rangeSessions=(data||[]).filter(s=>s.practice_type==='range');
    const courseSessions=(data||[]).filter(s=>s.practice_type==='course');
    if(rangeEl)rangeEl.innerHTML=_renderPracticeList(rangeSessions,'range');
    if(courseEl)courseEl.innerHTML=_renderPracticeList(courseSessions,'course');
  }catch(e){
    _practiceSessionsAvailable=false;
    const migMsg='<div class="stats-empty-small">Run the latest migration to enable this feature.</div>';
    if(rangeEl)rangeEl.innerHTML=migMsg;
    if(courseEl)courseEl.innerHTML=migMsg;
  }
}

function clearRangeForm(){['range-date','range-club','range-focus','range-balls','range-good','range-miss','range-cue','range-conf','range-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});}
function clearCourseForm(){['course-date','course-title','course-focus','course-miss','course-notes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});}

async function addRangeSession(){
  if(!_currentUserId){msg('Log in first.',true);return;}
  if(!_practiceSessionsAvailable){msg('Run the latest migration to enable range logs.',true);return;}
  const d=id=>document.getElementById(id);
  const{error}=await sb.from('practice_sessions').insert({
    user_id:_currentUserId,
    practice_type:'range',
    session_date:d('range-date')?.value||new Date().toISOString().slice(0,10),
    club_key:d('range-club')?.value?.trim()||null,
    focus_area:d('range-focus')?.value?.trim()||null,
    balls:parseInt(d('range-balls')?.value)||null,
    good_shots:parseInt(d('range-good')?.value)||null,
    main_miss:d('range-miss')?.value?.trim()||null,
    best_cue:d('range-cue')?.value?.trim()||null,
    confidence:parseInt(d('range-conf')?.value)||null,
    notes:d('range-notes')?.value?.trim()||null
  });
  if(error){msg(error.message,true);return;}
  msg('Range session added');
  clearRangeForm();
  await loadPracticeSessions();
}

async function addCourseNote(){
  if(!_currentUserId){msg('Log in first.',true);return;}
  if(!_practiceSessionsAvailable){msg('Run the latest migration to enable course notes.',true);return;}
  const d=id=>document.getElementById(id);
  const{error}=await sb.from('practice_sessions').insert({
    user_id:_currentUserId,
    practice_type:'course',
    session_date:d('course-date')?.value||new Date().toISOString().slice(0,10),
    title:d('course-title')?.value?.trim()||null,
    focus_area:d('course-focus')?.value?.trim()||null,
    main_miss:d('course-miss')?.value?.trim()||null,
    notes:d('course-notes')?.value?.trim()||null
  });
  if(error){msg(error.message,true);return;}
  msg('Course note added');
  clearCourseForm();
  await loadPracticeSessions();
}

// ── Profile section (More → Profile) ──────────────────────────────────────
let _profileExists=false;

async function loadProfileSection(){
  const el=document.getElementById('more-section-body');
  if(!el)return;
  if(!_currentUserId){
    el.innerHTML='<div class="stats-login-note">Log in to view and edit your profile.</div>';
    return;
  }
  el.innerHTML='<div class="stats-loading">Loading…</div>';
  try{
    const{data,error}=await sb.from('profiles').select('display_name,handicap,dominant_hand,main_goal').eq('user_id',_currentUserId).maybeSingle();
    if(error&&error.code!=='PGRST116'){
      // Table likely doesn't exist yet
      el.innerHTML='<div class="more-placeholder">Run the latest migration to enable profile settings.<br><br><code style="font-size:11px;color:var(--text3)">migration.sql → Phase 9 block</code></div>';
      return;
    }
    _profileExists=!!data;
    el.innerHTML=`<div class="profile-form">
      <div class="profile-field">
        <label class="profile-label">Display name</label>
        <input id="profile-name" type="text" placeholder="e.g. Joel" value="${escapeHtml(data?.display_name||'')}" autocorrect="off" spellcheck="false">
      </div>
      <div class="profile-field">
        <label class="profile-label">Handicap</label>
        <input id="profile-handicap" type="number" step="0.1" min="0" max="54" placeholder="e.g. 18.4" value="${data?.handicap!=null?data.handicap:''}" inputmode="decimal">
      </div>
      <div class="profile-field">
        <label class="profile-label">Dominant hand</label>
        <select id="profile-hand">
          <option value="right"${(data?.dominant_hand||'right')==='right'?' selected':''}>Right</option>
          <option value="left"${data?.dominant_hand==='left'?' selected':''}>Left</option>
        </select>
      </div>
      <div class="profile-field">
        <label class="profile-label">Main goal</label>
        <input id="profile-goal" type="text" placeholder="e.g. Break 90" value="${escapeHtml(data?.main_goal||'')}" autocorrect="off" spellcheck="false">
      </div>
      <button id="save-profile-btn" class="profile-save-btn" onclick="saveProfile()">Save profile</button>
      <div id="profile-msg" class="profile-msg"></div>
    </div>`;
  }catch(e){
    el.innerHTML='<div class="stats-error">Failed to load profile. Try again.</div>';
  }
}

async function saveProfile(){
  if(!_currentUserId)return;
  const btn=document.getElementById('save-profile-btn');
  const msgEl=document.getElementById('profile-msg');
  if(btn)btn.disabled=true;
  const display_name=document.getElementById('profile-name')?.value?.trim()||null;
  const hVal=document.getElementById('profile-handicap')?.value;
  const handicap=hVal!==''&&hVal!=null?parseFloat(hVal):null;
  const dominant_hand=document.getElementById('profile-hand')?.value||'right';
  const main_goal=document.getElementById('profile-goal')?.value?.trim()||null;
  const{error}=await sb.from('profiles').upsert({
    user_id:_currentUserId,display_name,handicap,dominant_hand,main_goal,updated_at:new Date().toISOString()
  },{onConflict:'user_id'});
  if(btn)btn.disabled=false;
  if(error){
    if(msgEl){msgEl.textContent='Error: '+error.message;msgEl.classList.add('error');}
  }else{
    _profileExists=true;
    if(msgEl){msgEl.textContent='Saved ✓';msgEl.classList.remove('error');setTimeout(()=>{if(msgEl)msgEl.textContent='';},2500);}
  }
}

// ══ Round tracking UI ═════════════════════════════════════════════════════════

async function loadRoundsSummary(){
  const summaryEl=document.getElementById('stats-rounds-summary');
  const listEl=document.getElementById('stats-rounds-list');
  if(!summaryEl&&!listEl)return;
  if(!_currentUserId){if(summaryEl)summaryEl.innerHTML='<div class="stats-login-note">Log in to see rounds.</div>';return;}
  try{
    const rounds=await window.loadRounds(10);
    if(!rounds.length){
      if(summaryEl)summaryEl.innerHTML='<div class="stats-empty-small">No rounds yet. Import your first round above.</div>';
      if(listEl)listEl.innerHTML='';
      return;
    }
    const last=rounds[0];
    const rWithPutts=rounds.filter(r=>r.total_putts);
    const avgPutts=rWithPutts.length?Math.round(rWithPutts.reduce((s,r)=>s+r.total_putts,0)/rWithPutts.length):null;
    if(summaryEl)summaryEl.innerHTML=`<div class="round-kpi-band">
      <div class="round-kpi-item"><div class="round-kpi-val">${rounds.length}</div><div class="round-kpi-lbl">Rounds</div></div>
      <div class="round-kpi-item"><div class="round-kpi-val">${last.total_strokes??'–'}</div><div class="round-kpi-lbl">Last score</div></div>
      <div class="round-kpi-item"><div class="round-kpi-val">${avgPutts??'–'}</div><div class="round-kpi-lbl">Avg putts</div></div>
      <div class="round-kpi-item"><div class="round-kpi-val">${last.round_date}</div><div class="round-kpi-lbl">Last round</div></div>
    </div>`;
    if(listEl)listEl.innerHTML=rounds.slice(0,5).map(r=>`
      <div class="round-row" id="round-row-${escapeHtml(r.id)}">
        <div class="round-row-head" onclick="toggleRoundRow('${escapeHtml(r.id)}')">
          <div class="round-row-info">
            <span class="round-date">${escapeHtml(r.round_date)}</span>
            <span class="round-course">${escapeHtml(r.course_name)}</span>
          </div>
          <div class="round-row-kpis">
            ${r.total_strokes?`<span class="round-score">${r.total_strokes}</span>`:''}
            ${r.total_putts?`<span class="round-putts">${r.total_putts}p</span>`:''}
          </div>
          <span class="round-arrow">›</span>
        </div>
        <div class="round-row-body" id="round-body-${escapeHtml(r.id)}" style="display:none;"></div>
      </div>`).join('');
  }catch(e){
    const m='<div class="stats-empty-small">Run the latest migration to enable round tracking.</div>';
    if(summaryEl)summaryEl.innerHTML=m;
    if(listEl)listEl.innerHTML='';
  }
}

window.toggleRoundRow=async function(roundId){
  const body=document.getElementById('round-body-'+roundId);
  const head=document.querySelector(`#round-row-${roundId} .round-row-head`);
  if(!body)return;
  if(body.style.display==='none'||!body.style.display){
    body.style.display='block';
    body.innerHTML='<div class="round-body-loading">Loading…</div>';
    if(head)head.classList.add('open');
    try{
      const shots=await window.loadRoundShots(roundId);
      const summary=window.computeRoundSummary(shots);
      body.innerHTML=_renderRoundBody(shots,summary,roundId);
    }catch(e){
      body.innerHTML='<div class="stats-error">Failed to load shots.</div>';
    }
  }else{
    body.style.display='none';
    if(head)head.classList.remove('open');
  }
};

function _renderRoundBody(shots,summary,roundId){
  const byHole={};
  shots.forEach(s=>{if(!byHole[s.hole])byHole[s.hole]=[];byHole[s.hole].push(s);});
  const holeNums=Object.keys(byHole).map(Number).sort((a,b)=>a-b);
  const rows=holeNums.map(h=>{
    const hs=byHole[h];
    const par=hs[0]?.par??'–';
    const strokes=hs.length;
    const putts=hs.filter(s=>(s.club||'').toLowerCase()==='putter').length;
    const clubs=[...new Set(hs.map(s=>s.club).filter(Boolean))].join(', ');
    const notes=hs.map(s=>s.comment).filter(Boolean).join('; ');
    return`<tr><td>${h}</td><td>${par}</td><td>${strokes}</td><td>${putts}</td><td>${escapeHtml(clubs)}</td><td style="max-width:120px;word-break:break-word">${escapeHtml(notes)}</td></tr>`;
  }).join('');
  const totRow=`<tr class="round-table-total"><td colspan="2">Total</td><td>${summary.totalStrokes}</td><td>${summary.totalPutts}</td><td colspan="2"></td></tr>`;
  return`<div class="round-table-wrap"><table class="round-table">
    <thead><tr><th>Hole</th><th>Par</th><th>Shots</th><th>Putts</th><th>Clubs</th><th>Notes</th></tr></thead>
    <tbody>${rows}${totRow}</tbody>
  </table></div>
  <div class="round-body-actions">
    <button class="round-delete-btn" onclick="deleteRoundById('${escapeHtml(roundId)}')">Delete round</button>
  </div>`;
}

window.deleteRoundById=async function(roundId){
  if(!_currentUserId)return;
  if(!confirm('Delete this round and all its shots?'))return;
  const result=await window.deleteRound(roundId);
  if(!result.ok){alert('Error: '+(result.error?.message||'Unknown'));return;}
  await loadRoundsSummary();
};

function previewRoundImport(){
  const ta=document.getElementById('rounds-import-tsv');
  const preEl=document.getElementById('rounds-import-preview');
  const impBtn=document.getElementById('rounds-import-btn');
  const text=ta?.value||'';
  if(!text.trim()){
    if(preEl)preEl.innerHTML='<span style="color:var(--red)">Paste your GolfPad data first.</span>';
    return;
  }
  try{
    const parsed=window.parseGolfPadTSV(text);
    _pendingRoundImport=parsed;
    const holeSummary=parsed.holes.map(h=>{
      const diff=h.par?h.strokes-h.par:null;
      const vs=diff===null?'':diff===0?' (par)':diff>0?` (+${diff})`:(` (${diff})`);
      return`H${h.hole}: ${h.strokes} shots${vs}`;
    }).join(' · ');
    if(preEl)preEl.innerHTML=`<div><strong>Found:</strong> ${parsed.holes.length} holes · ${parsed.shots.length} shots · ${escapeHtml(parsed.courseName)} · ${escapeHtml(parsed.roundDate)}</div><div style="margin-top:6px;color:var(--text3);font-size:11px;">${escapeHtml(holeSummary)}</div>`;
    if(impBtn)impBtn.style.display='inline-block';
  }catch(e){
    _pendingRoundImport=null;
    if(preEl)preEl.innerHTML='<span style="color:var(--red)">Parse error: '+escapeHtml(e.message)+'</span>';
    if(impBtn)impBtn.style.display='none';
  }
}

async function confirmRoundImport(){
  if(!_pendingRoundImport){previewRoundImport();return;}
  const msgEl=document.getElementById('rounds-import-msg');
  const impBtn=document.getElementById('rounds-import-btn');
  if(impBtn)impBtn.disabled=true;
  const summary=window.computeRoundSummary(_pendingRoundImport.shots);
  const {roundDate,courseName}=_pendingRoundImport;
  const result=await window.importRound(_pendingRoundImport);
  if(impBtn)impBtn.disabled=false;
  if(!result.ok){
    if(msgEl){msgEl.textContent='Error: '+(result.error?.message||'Unknown error');msgEl.style.color='var(--red)';}
    return;
  }
  _pendingRoundImport=null;
  const ta=document.getElementById('rounds-import-tsv');if(ta)ta.value='';
  const preEl=document.getElementById('rounds-import-preview');if(preEl)preEl.innerHTML='';
  if(impBtn)impBtn.style.display='none';
  // Build post-import summary card
  const parLines=[3,4,5].filter(p=>summary.byPar[p]).map(p=>{
    const b=summary.byPar[p];const s=b.avgRelPar>=0?`+${b.avgRelPar.toFixed(1)}`:`${b.avgRelPar.toFixed(1)}`;
    return`<span>Par ${p}: <strong>${s}</strong> avg (${b.count}h)</span>`;
  }).join(' &nbsp;');
  const udParts=[];
  if(summary.roughUD.att>0)udParts.push(`Rough ${summary.roughUD.made}/${summary.roughUD.att}`);
  if(summary.bunkerUD.att>0)udParts.push(`Bunker ${summary.bunkerUD.made}/${summary.bunkerUD.att}`);
  if(msgEl){
    msgEl.style.color='';
    msgEl.innerHTML=`<div style="background:var(--surface2);border-radius:10px;padding:10px 12px;margin-top:8px;font-size:13px;line-height:1.8;">
      <div style="color:var(--green);font-weight:600;margin-bottom:4px;">✓ Round imported</div>
      <div style="color:var(--text2);font-size:12px;">${escapeHtml(courseName)} · ${escapeHtml(roundDate)}</div>
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;">
        <span>Score: <strong>${summary.totalStrokes}</strong></span>
        <span>Putts: <strong>${summary.totalPutts}</strong></span>
        <span>GIR: <strong>${summary.girCount}/${summary.holesPlayed}</strong></span>
        ${summary.fwHitCount?`<span>FW: <strong>${summary.fwHitCount}</strong></span>`:''}
      </div>
      ${parLines?`<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;color:var(--text2);">${parLines}</div>`:''}
      ${udParts.length?`<div style="margin-top:4px;color:var(--text2);font-size:12px;">Up-and-down — ${udParts.join(' · ')}</div>`:''}
    </div>`;
  }
  await loadRoundsSummary();
}

// ── Exports ───────────────────────────────────────────────────────────────
window.loadOneState=loadOneState;window.deleteOneState=deleteOneState;
window.loadStatsPage=loadStatsPage;
window.startEditChippingSession=startEditChippingSession;window.deleteChippingSession=deleteChippingSession;window.cancelEditChippingSession=cancelEditChippingSession;
window.startEditPuttingSession=startEditPuttingSession;window.deletePuttingSession=deletePuttingSession;window.cancelEditPuttingSession=cancelEditPuttingSession;
window.openClubInAnalysis=openClubInAnalysis;
window.addRangeSession=addRangeSession;window.addCourseNote=addCourseNote;
window.loadProgressSection=loadProgressSection;
window.loadProfileSection=loadProfileSection;window.saveProfile=saveProfile;
window.loadRoundsSummary=loadRoundsSummary;
window.previewRoundImport=previewRoundImport;window.confirmRoundImport=confirmRoundImport;

window.addEventListener('DOMContentLoaded',async()=>{
  const b=(id,fn)=>{const e=document.getElementById(id);if(e)e.addEventListener('click',fn);};
  b('signup-btn',signUp);b('login-btn',logIn);b('logout-btn',logOut);
  b('add-chip-btn',addChippingSession);b('update-chip-btn',updateChippingSession);b('cancel-chip-edit-btn',cancelEditChippingSession);
  b('add-putt-btn',addPuttingSession);b('update-putt-btn',updatePuttingSession);b('cancel-putt-edit-btn',cancelEditPuttingSession);
  b('add-range-btn',addRangeSession);b('add-course-btn',addCourseNote);

  // Auto-fill today's date on forms
  const today=new Date().toISOString().slice(0,10);
  ['chip-date','putt-date','range-date','course-date'].forEach(id=>{const e=document.getElementById(id);if(e&&!e.value)e.value=today;});

  // Live bucket counter & R12 watchers
  ['chip-in1','chip-in2','chip-in3','chip-out3','chip-attempts'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',updateBucketCounter);
  });
  ['chip-club','chip-distance'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',updateR12);
  });

  await refreshSession();
});
