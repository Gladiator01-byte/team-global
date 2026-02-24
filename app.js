const CENTER = { lat: 6.5244, lng: 3.3792, radiusM: 250 };
const ROTATE_SECONDS = 45;
let currentUser = JSON.parse(localStorage.getItem("tg_user") || "null");
let currentNonce = null;
let timer = null;
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll('.tab')];
const panels = [...document.querySelectorAll('.panel')];

function wat(ts){ return new Date(ts).toLocaleString('en-NG',{timeZone:'Africa/Lagos',hour12:false}); }
function saveUser(){ localStorage.setItem("tg_user", JSON.stringify(currentUser)); }
function logs(){ return JSON.parse(localStorage.getItem("tg_logs")||"[]"); }
function setLogs(v){ localStorage.setItem("tg_logs", JSON.stringify(v)); renderLogs(); renderReports(); }
function hashCode(str){ let h=0; for(let i=0;i<str.length;i++) h=((h<<5)-h)+str.charCodeAt(i)|0; return Math.abs(h); }
function makeNonce(){
  const now=Date.now();
  return {
    nonce: crypto.randomUUID(),
    iat: now,
    exp: now + ROTATE_SECONDS*1000,
    teamId: currentUser?.teamId || 'TEAM-LAGOS-1',
    leaderId: currentUser?.name || 'leader',
    locationHint: 'Lagos HQ'
  }
}
function drawPseudoQR(payload){
  const c=$('qrCanvas'), ctx=c.getContext('2d');
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,256,256);
  const size=29, cell=8, seed=hashCode(payload);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const v=(seed + x*31 + y*17 + (x*y))%7<3;
    if(v){ ctx.fillStyle='#111827'; ctx.fillRect(12+x*cell,12+y*cell,cell-1,cell-1); }
  }
}
function renderUser(){
  $('whoami').textContent = currentUser ? `Signed in: ${currentUser.name} (${currentUser.role}) | Team ${currentUser.teamId}` : 'Not signed in';
  $('authState').textContent = currentUser ? 'Session active.' : 'No session yet.';
}
function renderLogs(){
  const mine = logs().filter(l => l.user===currentUser?.name).slice(-8).reverse();
  $('myLogs').innerHTML = mine.map(l => `<li>${l.type} • ${wat(l.time)} ${l.anomaly?`• ⚠️ ${l.anomaly}`:''}</li>`).join('') || '<li>No logs yet.</li>';
}
function renderReports(){
  $('reportBody').innerHTML = logs().slice().reverse().map(l => `<tr><td>${l.user}</td><td>${l.teamId}</td><td>${l.type}</td><td>${wat(l.time)}</td><td>${l.anomaly||''}</td></tr>`).join('');
}
async function geoCheck(){
  return new Promise((resolve) => {
    if(!navigator.geolocation) return resolve({ok:false, reason:'No geolocation support'});
    navigator.geolocation.getCurrentPosition((p)=>{
      const d = haversine(p.coords.latitude,p.coords.longitude,CENTER.lat,CENTER.lng);
      const ok = d <= CENTER.radiusM && p.coords.accuracy <= 150;
      resolve({ok, dist:Math.round(d), acc:Math.round(p.coords.accuracy), reason: ok? '' : 'Outside geofence or poor accuracy'});
    },()=> resolve({ok:false, reason:'Location permission denied'}), {enableHighAccuracy:true, timeout:7000});
  })
}
function haversine(lat1, lon1, lat2, lon2){
  const R=6371000, toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
async function biometricPrompt(){
  if(window.PublicKeyCredential){
    return !!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  }
  return false;
}
function startRotation(){
  if(timer) clearInterval(timer);
  function tick(){
    currentNonce = makeNonce();
    const payload = JSON.stringify(currentNonce);
    $('qrPayload').textContent = payload;
    drawPseudoQR(payload);
    const ttl = Math.ceil((currentNonce.exp-Date.now())/1000);
    $('qrMeta').textContent = `Live nonce. Regenerates every ${ROTATE_SECONDS}s. TTL: ${ttl}s`;
  }
  tick();
  timer = setInterval(()=>{
    if(!currentNonce) return;
    const ttl = Math.ceil((currentNonce.exp-Date.now())/1000);
    if(ttl<=0) tick(); else $('qrMeta').textContent = `Live nonce. Regenerates every ${ROTATE_SECONDS}s. TTL: ${ttl}s`;
  },1000);
}

$('registerPasskey').onclick = async () => {
  currentUser = { name: $('name').value, role: $('role').value, teamId: $('teamId').value, passkeyRegistered: true };
  saveUser(); renderUser(); renderLogs();
  $('authState').textContent = 'Passkey registered (demo mode).';
}
$('signinPasskey').onclick = async () => {
  if(!currentUser){ $('authState').textContent='Register first.'; return; }
  const bio = await biometricPrompt();
  $('authState').textContent = bio ? 'Biometric accepted (demo).' : 'Passkey sign-in accepted (demo).';
}
$('scanBtn').onclick = async () => {
  if(!currentUser || currentUser.role!=='employee'){ $('scanStatus').textContent='Employee login required.'; return; }
  let parsed; try{ parsed = JSON.parse($('scanInput').value); }catch{ $('scanStatus').textContent='Invalid QR payload'; return; }
  if(Date.now()>parsed.exp){ $('scanStatus').textContent='Expired nonce rejected.'; return; }
  const used = JSON.parse(localStorage.getItem('used_nonces')||'[]');
  if(used.includes(parsed.nonce)){ $('scanStatus').textContent='Replay detected: nonce already used.'; return; }
  const geo = await geoCheck();
  if(!geo.ok){ $('scanStatus').textContent = `Blocked: ${geo.reason}`; return; }
  const bio = await biometricPrompt();
  if(!bio){ $('scanStatus').textContent='Biometric capability required/preferred.'; }
  used.push(parsed.nonce); localStorage.setItem('used_nonces', JSON.stringify(used));
  const mine = logs().filter(l=>l.user===currentUser.name);
  const open = mine.length && mine[mine.length-1].type==='SIGN_IN';
  const entry = { user: currentUser.name, teamId: currentUser.teamId, type: open?'SIGN_OUT':'SIGN_IN', time: Date.now(), anomaly: '' };
  const all=logs(); all.push(entry); setLogs(all);
  $('scanStatus').textContent = `${entry.type} successful. Distance ${geo.dist}m, accuracy ${geo.acc}m.`;
}
$('startQr').onclick = ()=>{
  if(!currentUser || !['leader','admin','delegate'].includes(currentUser.role)){ $('qrMeta').textContent='Leader/admin/delegate required.'; return; }
  startRotation();
}
$('pauseQr').onclick = ()=>{ clearInterval(timer); timer=null; $('qrMeta').textContent='QR paused.'; }
$('stopQr').onclick = ()=>{ clearInterval(timer); timer=null; currentNonce=null; $('qrMeta').textContent='QR stopped.'; $('qrPayload').textContent=''; drawPseudoQR(''); }
$('exportCsv').onclick = ()=>{
  const rows = ['user,team,type,time,anomaly', ...logs().map(l=>`${l.user},${l.teamId},${l.type},${wat(l.time)},${l.anomaly||''}`)];
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='attendance-report.csv'; a.click();
}
$('importCsv').onchange = async (e)=>{
  const file=e.target.files?.[0]; if(!file) return;
  const text = await file.text();
  const rows = text.trim().split('\n').slice(1).map(r=>r.split(','));
  const imported = rows.map(r=>({user:r[0], teamId:r[1], type:r[2], time:Date.parse(r[3])||Date.now(), anomaly:r[4]||''}));
  setLogs([...logs(), ...imported]);
}

tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));panels.forEach(p=>p.classList.remove('active'));t.classList.add('active');$(t.dataset.tab).classList.add('active')});

window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; $('installBtn').style.display='inline-block'; });
$('installBtn').onclick = async ()=>{ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; } }
$('themeBtn').onclick = ()=> document.body.classList.toggle('dark');
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
renderUser(); renderLogs(); renderReports(); drawPseudoQR('');
