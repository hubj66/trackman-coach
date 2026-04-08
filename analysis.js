// analysis.js — v2
// Trend line, session date coloring, editable rows, flexible club key matching

// ── State ──────────────────────────────────────────────────────────────────
let analysisClub   = '7';
let analysisFilter = 'progress';
let analysisShots  = [];
let analysisRawSort = { col: 'created_at', dir: -1 };
let editingRowId   = null;
let currentProgKey = 'carry';

// Club definitions — key is what we track in state, patterns are matched against DB values
const ANALYSIS_CLUBS = [
  { key:'4',  label:'4i',  patterns:['4i','4iron','4 iron','4'] },
  { key:'5',  label:'5i',  patterns:['5i','5iron','5 iron','5'] },
  { key:'6',  label:'6i',  patterns:['6i','6iron','6 iron','6'] },
  { key:'7',  label:'7i',  patterns:['7i','7iron','7 iron','7'] },
  { key:'8',  label:'8i',  patterns:['8i','8iron','8 iron','8'] },
  { key:'9',  label:'9i',  patterns:['9i','9iron','9 iron','9'] },
  { key:'pw', label:'PW',  patterns:['pw','pitching wedge','p wedge','pw '] },
  { key:'sw', label:'SW',  patterns:['sw','sand wedge','s wedge'] },
  { key:'58', label:'58°', patterns:['58','58°'] },
];

const FILTER_OPTIONS = [
  { key:'all',           label:'All shots' },
  { key:'full',          label:'Full swings' },
  { key:'progress',      label:'Progress shots' },
  { key:'full_progress', label:'Full + Progress' },
];

// Up to 12 session dates get distinct colours
const SESSION_COLORS = [
  '#00d68f','#ffaa00','#7b9cff','#ff7eb3','#40e0d0',
  '#f4a460','#b8ff5a','#ff6b6b','#c084fc','#34d3f7',
  '#fbbf24','#a3e635',
];

// ── Club helpers ───────────────────────────────────────────────────────────
function clubLabel(key) { return ANALYSIS_CLUBS.find(c=>c.key===key)?.label || key.toUpperCase(); }

function shotMatchesClub(shot, key) {
  const raw = (shot.club || '').toLowerCase().trim();
  const def = ANALYSIS_CLUBS.find(c=>c.key===key);
  if (!def) return false;
  // exact match first (handles single-digit clubs like '7')
  if (raw === key.toLowerCase()) return true;
  return def.patterns.some(p => {
    const pl = p.toLowerCase();
    return raw === pl || raw === pl.trim();
  });
}

function buildSessionColorMap(shots) {
  const dates = [...new Set(
    [...shots]
      .sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
      .map(s => s.created_at?.slice(0,10))
      .filter(Boolean)
  )];
  const map = {};
  dates.forEach((d,i) => { map[d] = SESSION_COLORS[i % SESSION_COLORS.length]; });
  return map;
}

// ── Init ───────────────────────────────────────────────────────────────────
function initAnalysisTab() {
  const tabEl = document.getElementById('analysis-club-tabs');
  if (!tabEl) return;
  tabEl.innerHTML = ANALYSIS_CLUBS.map(c =>
    `<button class="atab${c.key===analysisClub?' on':''}" onclick="setAnalysisClub('${c.key}')">${c.label}</button>`
  ).join('');

  const filtEl = document.getElementById('analysis-filter-tabs');
  if (filtEl) filtEl.innerHTML = FILTER_OPTIONS.map(f =>
    `<button class="filter-tab${f.key===analysisFilter?' on':''}" onclick="setAnalysisFilter('${f.key}')">${f.label}</button>`
  ).join('');

  loadAnalysis();
}

function setAnalysisClub(key) {
  analysisClub = key;
  document.querySelectorAll('.atab').forEach(t =>
    t.classList.toggle('on', t.textContent === clubLabel(key))
  );
  loadAnalysis();
}

function setAnalysisFilter(key) {
  analysisFilter = key;
  document.querySelectorAll('.filter-tab').forEach(t =>
    t.classList.toggle('on', t.textContent === FILTER_OPTIONS.find(f=>f.key===key)?.label)
  );
  renderAnalysis(analysisShots);
}

// ── Data loading ───────────────────────────────────────────────────────────
async function loadAnalysis() {
  const el = document.getElementById('analysis-content');
  if (!el) return;
  el.innerHTML = '<div class="analysis-loading">Loading…</div>';
  editingRowId = null;

  const sb = window.supabaseClient;
  // Fetch broadly (no server-side club filter) so client-side matching handles '7' vs '7i'
  const { data, error } = await sb
    .from('trackman_shots')
    .select('id,club,carry,total,side,total_side,smash_factor,ball_speed,club_speed,spin_rate,launch_angle,launch_direction,attack_angle,club_path,face_angle,face_to_path,dyn_loft,spin_loft,spin_axis,max_height,landing_angle,hang_time,notes,is_full_shot,exclude_from_progress,shot_type,strike_quality,created_at')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    el.innerHTML = `<div class="analysis-empty">Error: ${escapeHtml(error.message)}</div>`;
    return;
  }

  analysisShots = (data || []).filter(s => shotMatchesClub(s, analysisClub));
  renderAnalysis(analysisShots);
}

function applyFilter(shots) {
  switch (analysisFilter) {
    case 'full':          return shots.filter(s => s.is_full_shot !== false);
    case 'progress':      return shots.filter(s => s.exclude_from_progress !== true);
    case 'full_progress': return shots.filter(s => s.is_full_shot !== false && s.exclude_from_progress !== true);
    default:              return shots;
  }
}

// ── Main render ────────────────────────────────────────────────────────────
function renderAnalysis(allShots) {
  const el = document.getElementById('analysis-content');
  if (!el) return;
  const shots = applyFilter(allShots);
  const colorMap = buildSessionColorMap(allShots);

  if (!shots.length) {
    el.innerHTML = `<div class="analysis-empty">
      No <strong>${clubLabel(analysisClub)}</strong> shots for this filter.
      <br><small>Try "All shots" or check club names in Trackman (e.g. "7" or "7i" both work).</small>
    </div>`;
    return;
  }

  el.innerHTML = `
    ${renderOverviewKPIs(shots)}
    ${renderConsistencyAndDirection(shots)}
    ${renderDistanceControl(shots)}
    ${renderProgressSection(allShots)}
    ${renderShotTable(shots, colorMap)}
  `;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    drawProgressChart(currentProgKey, applyFilter(analysisShots));
  }));
}

// ── Stat helpers ───────────────────────────────────────────────────────────
function statAvg(arr) {
  const v = arr.filter(x => x!=null && !isNaN(x));
  return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null;
}
function statMedian(arr) {
  const v = arr.filter(x=>x!=null&&!isNaN(x)).sort((a,b)=>a-b);
  if (!v.length) return null;
  const m = Math.floor(v.length/2);
  return v.length%2 ? v[m] : (v[m-1]+v[m])/2;
}
function statStdDev(arr) {
  const v = arr.filter(x=>x!=null&&!isNaN(x));
  if (v.length<2) return null;
  const a = statAvg(v);
  return Math.sqrt(v.reduce((s,x)=>s+(x-a)**2,0)/(v.length-1));
}
function statPercentile(arr, p) {
  const v = arr.filter(x=>x!=null&&!isNaN(x)).sort((a,b)=>a-b);
  if (!v.length) return null;
  const idx = (p/100)*(v.length-1);
  const lo=Math.floor(idx), hi=Math.ceil(idx);
  return lo===hi ? v[lo] : v[lo]+(v[hi]-v[lo])*(idx-lo);
}
function f(v,dp=1)    { return (v==null||isNaN(v)) ? '–' : Number(v).toFixed(dp); }
function fSign(v,dp=1){ return (v==null||isNaN(v)) ? '–' : (v>0?'+':'')+Number(v).toFixed(dp); }

// ── 1. Overview KPIs ───────────────────────────────────────────────────────
function renderOverviewKPIs(shots) {
  const carries  = shots.map(s=>s.carry).filter(Boolean);
  const smashes  = shots.map(s=>s.smash_factor).filter(Boolean);
  const bspeeds  = shots.map(s=>s.ball_speed).filter(Boolean);
  const cspeeds  = shots.map(s=>s.club_speed).filter(Boolean);
  const spins    = shots.map(s=>s.spin_rate).filter(Boolean);
  const launches = shots.map(s=>s.launch_angle).filter(Boolean);

  const kpis = [
    { l:'Shots',      v:shots.length,        fmt:v=>v },
    { l:'Avg Carry',  v:statAvg(carries),    fmt:v=>f(v,1),  unit:'m' },
    { l:'Median',     v:statMedian(carries), fmt:v=>f(v,1),  unit:'m' },
    { l:'Carry ±',    v:statStdDev(carries), fmt:v=>f(v,1),  unit:'m' },
    { l:'Smash',      v:statAvg(smashes),    fmt:v=>f(v,2),  unit:'' },
    { l:'Ball Spd',   v:statAvg(bspeeds),    fmt:v=>f(v,1),  unit:' mph' },
    { l:'Club Spd',   v:statAvg(cspeeds),    fmt:v=>f(v,1),  unit:' mph' },
    { l:'Avg Spin',   v:statAvg(spins),      fmt:v=>f(v,0),  unit:' rpm' },
    { l:'Launch',     v:statAvg(launches),   fmt:v=>f(v,1),  unit:'°' },
  ];

  return `<div class="analysis-section">
    <div class="analysis-section-title">${clubLabel(analysisClub)} Overview · ${shots.length} shots</div>
    <div class="analysis-kpi-grid">
      ${kpis.map(k => {
        const disp = k.fmt(k.v);
        const unit = disp==='–' ? '' : (k.unit||'');
        return `<div class="analysis-kpi-card">
          <div class="analysis-kpi-label">${k.l}</div>
          <div class="analysis-kpi-value">${disp}${unit}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── 2. Consistency + Direction ─────────────────────────────────────────────
function renderConsistencyAndDirection(shots) {
  const faces  = shots.map(s=>s.face_angle).filter(x=>x!=null);
  const paths  = shots.map(s=>s.club_path).filter(x=>x!=null);
  const ftps   = shots.map(s=>s.face_to_path).filter(x=>x!=null);
  const sides  = shots.map(s=>s.side).filter(x=>x!=null);
  const carries= shots.map(s=>s.carry).filter(Boolean);
  const smashes= shots.map(s=>s.smash_factor).filter(Boolean);

  const avgFace=statAvg(faces), avgPath=statAvg(paths);
  const avgFTP=statAvg(ftps),   avgSide=statAvg(sides);
  const left=sides.filter(s=>s<-2).length, right=sides.filter(s=>s>2).length, tot=sides.length||1;

  const miss = (() => {
    if (!avgFTP) return '–';
    if (avgFTP>4)  return avgPath>3?'Push Draw':'Draw';
    if (avgFTP<-4) return avgPath<-3?'Pull Fade':'Fade';
    if (avgFace>2) return 'Push';
    if (avgFace<-2)return 'Pull';
    return 'Neutral';
  })();

  const row = (l,v,u='') => `<div class="analysis-row"><span class="analysis-row-label">${l}</span><span class="analysis-row-value">${v}${u}</span></div>`;

  return `<div class="analysis-section">
    <div class="analysis-section-title">Consistency &amp; Direction</div>
    <div class="analysis-two-col">
      <div>
        <div class="analysis-col-label">StdDev</div>
        <div class="analysis-row-list">
          ${row('Carry ±', f(statStdDev(carries),1),'m')}
          ${row('Face ±',  f(statStdDev(faces),1),'°')}
          ${row('Path ±',  f(statStdDev(paths),1),'°')}
          ${row('Smash ±', f(statStdDev(smashes),3),'')}
        </div>
      </div>
      <div>
        <div class="analysis-col-label">Direction</div>
        <div class="analysis-row-list">
          ${row('Avg Face', fSign(avgFace),'°')}
          ${row('Avg Path', fSign(avgPath),'°')}
          ${row('Avg FTP',  fSign(avgFTP),'°')}
          ${row('% Left',   ((left/tot)*100).toFixed(0),'%')}
          ${row('% Right',  ((right/tot)*100).toFixed(0),'%')}
          ${row('Miss',     miss)}
        </div>
      </div>
    </div>
  </div>`;
}

// ── 3. Distance control ────────────────────────────────────────────────────
function renderDistanceControl(shots) {
  const c = shots.map(s=>s.carry).filter(Boolean);
  if (!c.length) return '';
  const s = [...c].sort((a,b)=>a-b);
  const row = (l,v) => `<div class="analysis-row"><span class="analysis-row-label">${l}</span><span class="analysis-row-value">${v}m</span></div>`;
  return `<div class="analysis-section">
    <div class="analysis-section-title">Distance Control</div>
    <div class="analysis-row-list" style="display:grid;grid-template-columns:1fr 1fr;">
      ${row('Min',    f(s[0]))}
      ${row('Max',    f(s[s.length-1]))}
      ${row('Range',  f(s[s.length-1]-s[0]))}
      ${row('Median', f(statMedian(c)))}
      ${row('P10',    f(statPercentile(c,10)))}
      ${row('P90',    f(statPercentile(c,90)))}
    </div>
  </div>`;
}

// ── 4. Progress chart ──────────────────────────────────────────────────────
function renderProgressSection(allShots) {
  const metrics = ['carry','smash_factor','ball_speed','spin_rate','launch_angle','face_angle','club_path','face_to_path'];
  return `<div class="analysis-section">
    <div class="analysis-section-title">Progress Over Time</div>
    <div class="progress-chart-tabs">
      ${metrics.map(k =>
        `<button class="prog-tab${k===currentProgKey?' on':''}" onclick="switchProgChart('${k}',this)">${progLabel(k)}</button>`
      ).join('')}
    </div>
    <canvas id="progress-canvas" height="190" style="width:100%;display:block;margin-top:8px;border-radius:10px;background:#161819;"></canvas>
  </div>`;
}

function progLabel(k) {
  return {carry:'Carry',smash_factor:'Smash',ball_speed:'Ball Spd',spin_rate:'Spin',launch_angle:'Launch',face_angle:'Face',club_path:'Path',face_to_path:'FTP'}[k]||k;
}

function switchProgChart(key, btn) {
  currentProgKey = key;
  document.querySelectorAll('.prog-tab').forEach(t=>t.classList.remove('on'));
  if(btn) btn.classList.add('on');
  drawProgressChart(key, applyFilter(analysisShots));
}

function drawProgressChart(key, shots) {
  const canvas = document.getElementById('progress-canvas');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio||2,3);
  const w = canvas.parentElement?.clientWidth || 340;
  const h = 190;
  canvas.width=w*dpr; canvas.height=h*dpr;
  canvas.style.width=w+'px'; canvas.style.height=h+'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr,dpr);

  const isSign = ['face_angle','club_path','face_to_path','attack_angle'].includes(key);
  const colorMap = buildSessionColorMap(shots);

  const ordered = [...shots]
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
    .filter(s=>s[key]!=null&&!isNaN(s[key]));
  const values = ordered.map(s=>Number(s[key]));
  const dates  = ordered.map(s=>s.created_at?.slice(0,10)||'');

  if (values.length<2) {
    ctx.fillStyle='#4e5660'; ctx.font="13px 'Barlow',sans-serif";
    ctx.textAlign='center'; ctx.fillText('Not enough data',w/2,h/2);
    return;
  }

  const pad={t:28,r:20,b:38,l:48};
  const cw=w-pad.l-pad.r, ch=h-pad.t-pad.b;
  const span=Math.max(...values)-Math.min(...values)||1;
  const min=Math.min(...values)-span*0.08;
  const max=Math.max(...values)+span*0.08;
  const px=i=>pad.l+(i/(values.length-1))*cw;
  const py=v=>pad.t+ch-((v-min)/(max-min))*ch;

  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
  ctx.font="9px 'DM Mono',monospace"; ctx.textAlign='right'; ctx.fillStyle='#4e5660';
  for(let i=0;i<=4;i++){
    const y=pad.t+(ch/4)*i;
    const val=max-((max-min)/4)*i;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke();
    ctx.fillText(isSign?(val>0?'+':'')+val.toFixed(1):val.toFixed(key==='spin_rate'?0:1), pad.l-6, y+3);
  }

  // Session boundary lines
  let prev='';
  ctx.setLineDash([3,4]); ctx.strokeStyle='rgba(255,255,255,0.09)'; ctx.lineWidth=1;
  dates.forEach((d,i)=>{
    if(d!==prev&&i>0){ctx.beginPath();ctx.moveTo(px(i),pad.t);ctx.lineTo(px(i),pad.t+ch);ctx.stroke();}
    prev=d;
  });
  ctx.setLineDash([]);

  // Area fill
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
  grad.addColorStop(0,'rgba(0,214,143,0.13)'); grad.addColorStop(1,'rgba(0,214,143,0)');
  ctx.fillStyle=grad;
  ctx.beginPath(); ctx.moveTo(px(0),py(values[0]));
  values.forEach((v,i)=>ctx.lineTo(px(i),py(v)));
  ctx.lineTo(px(values.length-1),pad.t+ch); ctx.lineTo(px(0),pad.t+ch); ctx.closePath(); ctx.fill();

  // Session-coloured dots
  values.forEach((v,i)=>{
    ctx.fillStyle=colorMap[dates[i]]||'#00d68f';
    ctx.globalAlpha=0.85;
    ctx.beginPath(); ctx.arc(px(i),py(v),3.5,0,Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha=1;

  // 5-shot rolling avg
  const roll=values.map((_,i)=>{
    const win=values.slice(Math.max(0,i-4),i+1);
    return win.reduce((a,b)=>a+b,0)/win.length;
  });
  ctx.strokeStyle='#00d68f'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); roll.forEach((v,i)=>i===0?ctx.moveTo(px(i),py(v)):ctx.lineTo(px(i),py(v))); ctx.stroke();

  // ── Linear trend line ──────────────────────────────────────────────────
  const n=values.length;
  const sX=values.reduce((_,__,i)=>_+i,0);
  const sY=values.reduce((a,b)=>a+b,0);
  const sXY=values.reduce((a,v,i)=>a+i*v,0);
  const sX2=values.reduce((a,_,i)=>a+i*i,0);
  const slope=(n*sXY-sX*sY)/(n*sX2-sX*sX);
  const intercept=(sY-slope*sX)/n;
  const tStart=intercept, tEnd=slope*(n-1)+intercept;
  const tCol=slope>0.01?'#00d68f':slope<-0.01?'#ff4d4d':'#8a9099';

  ctx.strokeStyle=tCol; ctx.lineWidth=1.5; ctx.globalAlpha=0.6; ctx.setLineDash([7,4]);
  ctx.beginPath(); ctx.moveTo(px(0),py(tStart)); ctx.lineTo(px(n-1),py(tEnd)); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha=1;

  // Trend label top-right
  const diff=tEnd-tStart;
  const arrow=slope>0.01?'↑':slope<-0.01?'↓':'→';
  ctx.font="700 10px 'Barlow Condensed',sans-serif";
  ctx.textAlign='right'; ctx.fillStyle=tCol;
  ctx.fillText(`${arrow} ${diff>0?'+':''}${diff.toFixed(key==='spin_rate'?0:1)}`, w-pad.r, pad.t-12);

  // Chart title top-left
  ctx.fillStyle='#f0ede8'; ctx.textAlign='left';
  ctx.font="700 11px 'Barlow Condensed',sans-serif";
  ctx.fillText(`${progLabel(key).toUpperCase()} · ${values.length} shots`, pad.l, pad.t-12);

  // Date legend bottom
  const uniqueDates=[...new Set(dates)];
  ctx.font="9px 'DM Mono',monospace"; ctx.textAlign='left';
  let lx=pad.l;
  uniqueDates.forEach(d=>{
    if(lx>w-60) return;
    const col=colorMap[d]||'#00d68f';
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(lx+4,pad.t+ch+20,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#6a7380';
    ctx.fillText(d.slice(5),lx+12,pad.t+ch+23);
    lx+=54;
  });
}

// ── 5. Shot table ──────────────────────────────────────────────────────────
function renderShotTable(shots, colorMap) {
  const sorted = sortShots([...shots], analysisRawSort.col, analysisRawSort.dir);
  const sa = col => col===analysisRawSort.col ? (analysisRawSort.dir>0?' ↑':' ↓') : '';
  let prevDate='';

  const rows = sorted.map(s => {
    const date = s.created_at?.slice(0,10)||'';
    const time = s.created_at
      ? new Date(s.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
      : '';
    const sessionCol = colorMap[date]||'#8a9099';
    const newDate = date !== prevDate;
    prevDate = date;

    if (s.id === editingRowId) {
      return `<tr class="shot-row shot-row-editing" data-id="${s.id}">
        <td>
          <span class="session-dot" style="background:${sessionCol}"></span>
          <span class="shot-date">${date}</span>
          <span class="shot-time">${time}</span>
        </td>
        <td>${f(s.carry,1)}</td>
        <td>${f(s.smash_factor,2)}</td>
        <td>${fSign(s.face_angle,1)}</td>
        <td>${fSign(s.club_path,1)}</td>
        <td>${fSign(s.face_to_path,1)}</td>
        <td>${fSign(s.attack_angle,1)}</td>
        <td>${f(s.launch_angle,1)}</td>
        <td>${s.spin_rate?Math.round(s.spin_rate):'–'}</td>
        <td>${fSign(s.side,1)}</td>
        <td>
          <select id="edit-full-${s.id}" class="edit-select">
            <option value="1"${s.is_full_shot!==false?' selected':''}>✓ Full</option>
            <option value="0"${s.is_full_shot===false?' selected':''}>– Part</option>
          </select>
        </td>
        <td>
          <select id="edit-excl-${s.id}" class="edit-select">
            <option value="0"${!s.exclude_from_progress?' selected':''}>Include</option>
            <option value="1"${s.exclude_from_progress?' selected':''}>Exclude</option>
          </select>
        </td>
        <td colspan="1">
          <input id="edit-notes-${s.id}" class="edit-notes-input" type="text"
            value="${escapeHtml(s.notes||'')}" placeholder="Notes…">
        </td>
        <td class="shot-actions">
          <button class="shot-action-btn shot-save" onclick="saveEditRow('${s.id}')">Save</button>
          <button class="shot-action-btn shot-cancel" onclick="cancelEditRow()">✕</button>
        </td>
      </tr>`;
    }

    return `<tr class="shot-row${newDate?' shot-row-new-date':''}" data-id="${s.id}">
      <td>
        <span class="session-dot" style="background:${sessionCol}"></span>
        <span class="shot-date">${date}</span>
        <br><span class="shot-time">${time}</span>
      </td>
      <td>${f(s.carry,1)}</td>
      <td>${f(s.smash_factor,2)}</td>
      <td class="${faceCol(s.face_angle)}">${fSign(s.face_angle,1)}</td>
      <td>${fSign(s.club_path,1)}</td>
      <td class="${ftpCol(s.face_to_path)}">${fSign(s.face_to_path,1)}</td>
      <td>${fSign(s.attack_angle,1)}</td>
      <td>${f(s.launch_angle,1)}</td>
      <td>${s.spin_rate?Math.round(s.spin_rate):'–'}</td>
      <td>${fSign(s.side,1)}</td>
      <td class="${s.is_full_shot===false?'cell-dim':'cell-good-dim'}">${s.is_full_shot===false?'–':'✓'}</td>
      <td class="${s.exclude_from_progress?'cell-warn':''}">${s.exclude_from_progress?'Excl':''}</td>
      <td class="shot-notes">${escapeHtml(s.notes||'')}</td>
      <td class="shot-actions">
        <button class="shot-action-btn shot-edit" onclick="startEditRow('${s.id}')">Edit</button>
      </td>
    </tr>`;
  }).join('');

  return `<div class="analysis-section" style="padding-bottom:48px;">
    <div class="analysis-section-title">
      Shot Log · ${sorted.length} shots
      <span class="shot-table-hint">· tap Edit to update notes &amp; flags</span>
    </div>
    <div class="analysis-raw-wrap">
      <table class="analysis-raw-table" id="raw-table">
        <thead>
          <tr>
            <th onclick="sortRawTable('created_at')">Date/Time${sa('created_at')}</th>
            <th onclick="sortRawTable('carry')">Carry${sa('carry')}</th>
            <th onclick="sortRawTable('smash_factor')">Smash${sa('smash_factor')}</th>
            <th onclick="sortRawTable('face_angle')">Face${sa('face_angle')}</th>
            <th onclick="sortRawTable('club_path')">Path${sa('club_path')}</th>
            <th onclick="sortRawTable('face_to_path')">FTP${sa('face_to_path')}</th>
            <th onclick="sortRawTable('attack_angle')">Atk${sa('attack_angle')}</th>
            <th onclick="sortRawTable('launch_angle')">Lch${sa('launch_angle')}</th>
            <th onclick="sortRawTable('spin_rate')">Spin${sa('spin_rate')}</th>
            <th onclick="sortRawTable('side')">Side${sa('side')}</th>
            <th>Full</th>
            <th>Prog</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function faceCol(v){ return v==null?'':Math.abs(v)<=2?'cell-good':Math.abs(v)<=4?'cell-warn':'cell-bad'; }
function ftpCol(v) { return v==null?'':Math.abs(v)<=3?'cell-good':Math.abs(v)<=6?'cell-warn':'cell-bad'; }

// ── Sort ───────────────────────────────────────────────────────────────────
function sortShots(shots, col, dir) {
  return shots.sort((a,b) => {
    const av=a[col], bv=b[col];
    if(av==null)return 1; if(bv==null)return -1;
    return (av<bv?-1:av>bv?1:0)*dir;
  });
}

function sortRawTable(col) {
  analysisRawSort = analysisRawSort.col===col
    ? { col, dir: analysisRawSort.dir*-1 }
    : { col, dir: -1 };
  renderAnalysis(analysisShots);
}

// ── Inline edit ────────────────────────────────────────────────────────────
function startEditRow(id) {
  editingRowId = id;
  renderAnalysis(analysisShots);
  requestAnimationFrame(()=>{
    document.querySelector(`tr[data-id="${id}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
}

function cancelEditRow() {
  editingRowId = null;
  renderAnalysis(analysisShots);
}

async function saveEditRow(id) {
  const fullEl  = document.getElementById(`edit-full-${id}`);
  const exclEl  = document.getElementById(`edit-excl-${id}`);
  const notesEl = document.getElementById(`edit-notes-${id}`);
  if (!fullEl||!exclEl||!notesEl) return;

  const updates = {
    is_full_shot:          fullEl.value==='1',
    exclude_from_progress: exclEl.value==='1',
    notes:                 notesEl.value.trim()||null,
  };

  const { error } = await window.supabaseClient
    .from('trackman_shots').update(updates).eq('id',id);

  if (error) { showToast('Save failed: '+error.message); return; }

  const idx = analysisShots.findIndex(s=>s.id===id);
  if(idx!==-1) analysisShots[idx]={...analysisShots[idx],...updates};
  editingRowId=null;
  showToast('Saved ✓');
  renderAnalysis(analysisShots);
}

// ── Expose globals ─────────────────────────────────────────────────────────
window.initAnalysisTab   = initAnalysisTab;
window.setAnalysisClub   = setAnalysisClub;
window.setAnalysisFilter = setAnalysisFilter;
window.switchProgChart   = switchProgChart;
window.sortRawTable      = sortRawTable;
window.startEditRow      = startEditRow;
window.cancelEditRow     = cancelEditRow;
window.saveEditRow       = saveEditRow;
window.loadAnalysis      = loadAnalysis;
