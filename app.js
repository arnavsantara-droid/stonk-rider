const STOCKS = [
  ["RELIANCE.NS","Reliance Industries"],["TCS.NS","Tata Consultancy Services"],["HDFCBANK.NS","HDFC Bank"],
  ["ICICIBANK.NS","ICICI Bank"],["INFY.NS","Infosys"],["BHARTIARTL.NS","Bharti Airtel"],["SBIN.NS","State Bank of India"],
  ["LT.NS","Larsen & Toubro"],["ITC.NS","ITC"],["HINDUNILVR.NS","Hindustan Unilever"],["BAJFINANCE.NS","Bajaj Finance"],
  ["MARUTI.NS","Maruti Suzuki"],["SUNPHARMA.NS","Sun Pharma"],["M&M.NS","Mahindra & Mahindra"],["KOTAKBANK.NS","Kotak Mahindra Bank"],
  ["AXISBANK.NS","Axis Bank"],["TITAN.NS","Titan"],["NTPC.NS","NTPC"],["ONGC.NS","ONGC"],["TATAMOTORS.NS","Tata Motors"],
  ["TATASTEEL.NS","Tata Steel"],["ADANIENT.NS","Adani Enterprises"],["ADANIPORTS.NS","Adani Ports"],["POWERGRID.NS","Power Grid"],
  ["COALINDIA.NS","Coal India"],["ASIANPAINT.NS","Asian Paints"],["ULTRACEMCO.NS","UltraTech Cement"],["WIPRO.NS","Wipro"],
  ["HCLTECH.NS","HCL Technologies"],["TECHM.NS","Tech Mahindra"],["NESTLEIND.NS","Nestle India"],["BAJAJFINSV.NS","Bajaj Finserv"],
  ["DRREDDY.NS","Dr Reddy's"],["CIPLA.NS","Cipla"],["GRASIM.NS","Grasim"],["JSWSTEEL.NS","JSW Steel"],
  ["HINDALCO.NS","Hindalco"],["EICHERMOT.NS","Eicher Motors"],["HEROMOTOCO.NS","Hero MotoCorp"],["APOLLOHOSP.NS","Apollo Hospitals"],
  ["DIVISLAB.NS","Divi's Labs"],["BRITANNIA.NS","Britannia"],["BPCL.NS","BPCL"],["INDUSINDBK.NS","IndusInd Bank"],
  ["SHRIRAMFIN.NS","Shriram Finance"],["TRENT.NS","Trent"],["BEL.NS","Bharat Electronics"],["HAL.NS","Hindustan Aeronautics"],
  ["INDIGO.NS","InterGlobe Aviation"],["DMART.NS","Avenue Supermarts"]
];

const $ = s => document.querySelector(s);
const canvas = $("#gameCanvas"), ctx = canvas.getContext("2d");
const tickerSelect = $("#tickerSelect"), rangeSelect = $("#rangeSelect");
const statusEl = $("#status"), priceValue=$("#priceValue"), dateValue=$("#dateValue"),
      scoreValue=$("#scoreValue"), lineValue=$("#lineValue");

for (const [ticker,name] of STOCKS) {
  const o=document.createElement("option"); o.value=ticker; o.textContent=`${name} (${ticker.replace(".NS","")})`; tickerSelect.appendChild(o);
}
tickerSelect.value="RELIANCE.NS";

let deferredPrompt=null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredPrompt=e; $("#installBtn").hidden=false;
});
$("#installBtn").addEventListener("click", async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $("#installBtn").hidden=true;
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});

let dpr=1, W=0, H=0;
function resize(){
  const r=canvas.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(320,Math.floor(r.width)); H=Math.max(300,Math.floor(r.height));
  canvas.width=Math.floor(W*dpr); canvas.height=Math.floor(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize", resize);

let points=[], terrain=[], sessionLines=[], minP=0,maxP=1;
let bike={x:60,y:200,vy:0,angle:0,angVel:0,speed:115,onGround:true,score:0};
let cameraX=0,lastT=0,running=false;
const input={gas:false,brake:false,leanLeft:false,leanRight:false};

function fmtDate(ts){ return new Date(ts*1000).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); }

async function loadData(){
  statusEl.textContent="Loading Indian market track…"; statusEl.classList.remove("hidden");
  running=false;
  const ticker=tickerSelect.value, range=rangeSelect.value;
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d&events=history&includeAdjustedClose=true`;
  try{
    const res=await fetch(url);
    if(!res.ok) throw new Error("Market data request failed");
    const json=await res.json();
    const r=json.chart?.result?.[0];
    if(!r) throw new Error(json.chart?.error?.description || "No market data");
    const q=r.indicators?.quote?.[0], adj=r.indicators?.adjclose?.[0]?.adjclose || [];
    points=r.timestamp.map((ts,i)=>({ts, p:adj[i] ?? q.close[i]})).filter(x=>Number.isFinite(x.p));
    if(points.length<10) throw new Error("Not enough price history");
    buildTerrain();
    resetGame();
    lineValue.textContent=sessionLines.length.toLocaleString("en-IN");
    statusEl.classList.add("hidden"); running=true; lastT=performance.now(); requestAnimationFrame(loop);
  }catch(err){
    console.error(err);
    statusEl.innerHTML=`Could not fetch Yahoo market data.<br><small>${err.message}. Try again or another network.</small>`;
  }
}

function buildTerrain(){
  minP=Math.min(...points.map(x=>x.p)); maxP=Math.max(...points.map(x=>x.p));
  const span=Math.max(1,maxP-minP);
  const dayWidth=92; // deliberately roomy: each trading session has 2 visible grid markers
  terrain=points.map((x,i)=>{
    const norm=(x.p-minP)/span;
    const y=H*0.79 - norm*H*0.48;
    return {x:i*dayWidth,y, ...x};
  });
  sessionLines=[];
  for(let i=0;i<points.length;i++){
    const x=i*dayWidth;
    sessionLines.push(x, x+dayWidth/2); // EXACTLY 2 lines per actual trading session
  }
}

function resetGame(){
  bike={x:70,y:terrainY(70)-24,vy:0,angle:0,angVel:0,speed:125,onGround:true,score:0};
  cameraX=0; scoreValue.textContent="0";
}
function terrainY(worldX){
  if(!terrain.length) return H*.7;
  const maxX=terrain[terrain.length-1].x;
  worldX=Math.max(0,Math.min(worldX,maxX));
  const idx=Math.min(terrain.length-2,Math.max(0,Math.floor(worldX/92)));
  const a=terrain[idx], b=terrain[idx+1]||a;
  const t=(worldX-a.x)/Math.max(1,b.x-a.x);
  const smooth=t*t*(3-2*t);
  return a.y+(b.y-a.y)*smooth;
}
function terrainSlope(worldX){
  const d=4; return Math.atan2(terrainY(worldX+d)-terrainY(worldX-d), d*2);
}

function physics(dt){
  if(input.gas) bike.speed+=95*dt;
  if(input.brake) bike.speed-=130*dt;
  bike.speed*=Math.pow(.993,dt*60);
  bike.speed=Math.max(35,Math.min(260,bike.speed));
  bike.x+=bike.speed*dt;

  const gy=terrainY(bike.x);
  const slope=terrainSlope(bike.x);
  const wheelY=bike.y+18;

  if(wheelY>=gy-2 && bike.vy>=-40){
    if(!bike.onGround){
      const clean=Math.max(0,1-Math.abs(normalizeAngle(bike.angle-slope))/1.2);
      bike.score += Math.round(clean*120 + Math.max(0,bike.speed-100)*.15);
    }
    bike.onGround=true;
    bike.y=gy-18;
    bike.vy=Math.min(0,bike.vy);
    bike.angle += normalizeAngle(slope-bike.angle)*Math.min(1,dt*9);
    bike.angVel*=.75;
    const dropAhead=terrainY(bike.x+32)-gy;
    if(dropAhead>24 && bike.speed>95){ bike.onGround=false; bike.vy=-35; }
  }else{
    bike.onGround=false;
    bike.vy+=470*dt;
    bike.y+=bike.vy*dt;
    if(input.leanLeft) bike.angVel-=4.2*dt;
    if(input.leanRight) bike.angVel+=4.2*dt;
    bike.angVel*=Math.pow(.985,dt*60);
    bike.angle+=bike.angVel;
    bike.score+=Math.round((Math.abs(bike.angVel)*6 + bike.speed*.002)*dt*10);
  }
  if(bike.onGround){
    if(input.leanLeft) bike.angle-=1.8*dt;
    if(input.leanRight) bike.angle+=1.8*dt;
  }

  const maxX=terrain[terrain.length-1].x;
  if(bike.x>=maxX-10){ bike.x=maxX-10; bike.speed=0; running=false; statusEl.textContent=`Track finished — score ${bike.score.toLocaleString("en-IN")}`; statusEl.classList.remove("hidden"); }
  cameraX += ((bike.x-W*.27)-cameraX)*Math.min(1,dt*4.5);
  cameraX=Math.max(0,Math.min(cameraX,Math.max(0,maxX-W)));
  scoreValue.textContent=bike.score.toLocaleString("en-IN");

  const idx=Math.max(0,Math.min(points.length-1,Math.round(bike.x/92)));
  priceValue.textContent=`₹${points[idx].p.toLocaleString("en-IN",{maximumFractionDigits:2})}`;
  dateValue.textContent=fmtDate(points[idx].ts);
}
function normalizeAngle(a){ while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2; return a; }

function draw(){
  ctx.clearRect(0,0,W,H);
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#0b1018"); g.addColorStop(1,"#07090d");
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  ctx.save(); ctx.translate(-cameraX,0);

  // Half-session markers: 2 per trading day, subtle white as requested.
  ctx.strokeStyle="rgba(255,255,255,0.13)"; ctx.lineWidth=1;
  ctx.beginPath();
  const left=cameraX-2, right=cameraX+W+2;
  for(const x of sessionLines){
    if(x<left||x>right) continue;
    ctx.moveTo(Math.round(x)+.5,0); ctx.lineTo(Math.round(x)+.5,H);
  }
  ctx.stroke();

  // Monthly labels near bottom.
  ctx.fillStyle="rgba(255,255,255,.42)"; ctx.font="11px system-ui";
  let lastMonth=-1;
  for(let i=0;i<terrain.length;i++){
    const x=terrain[i].x; if(x<left-100||x>right+100) continue;
    const d=new Date(terrain[i].ts*1000), m=d.getMonth();
    if(m!==lastMonth){ ctx.fillText(d.toLocaleDateString("en-IN",{month:"short",year:"2-digit"}),x+4,H-12); lastMonth=m; }
  }

  // Terrain fill
  ctx.beginPath();
  ctx.moveTo(terrain[0].x,H);
  for(const p of terrain) ctx.lineTo(p.x,p.y);
  ctx.lineTo(terrain[terrain.length-1].x,H);
  ctx.closePath();
  const tg=ctx.createLinearGradient(0,H*.25,0,H);
  tg.addColorStop(0,"rgba(94,230,168,.18)"); tg.addColorStop(1,"rgba(94,230,168,.02)");
  ctx.fillStyle=tg; ctx.fill();

  // Terrain line
  ctx.beginPath(); ctx.moveTo(terrain[0].x,terrain[0].y);
  for(const p of terrain) ctx.lineTo(p.x,p.y);
  ctx.strokeStyle="#8ef0c1"; ctx.lineWidth=3; ctx.lineJoin="round"; ctx.lineCap="round"; ctx.stroke();

  drawBike();
  ctx.restore();
}

function drawBike(){
  ctx.save(); ctx.translate(bike.x,bike.y); ctx.rotate(bike.angle);
  const wheelR=8;
  ctx.strokeStyle="#f8fafc"; ctx.lineWidth=2;
  for(const wx of [-13,13]){
    ctx.beginPath(); ctx.arc(wx,12,wheelR,0,Math.PI*2); ctx.stroke();
  }
  ctx.strokeStyle="#67e8f9"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-13,12); ctx.lineTo(-3,-3); ctx.lineTo(13,12); ctx.lineTo(4,1); ctx.lineTo(-13,12); ctx.stroke();
  ctx.strokeStyle="#f8fafc"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-3,-3); ctx.lineTo(5,-13); ctx.lineTo(11,-8); ctx.stroke();
  ctx.fillStyle="#f8fafc"; ctx.beginPath(); ctx.arc(5,-17,5,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function loop(t){
  if(!running) return;
  const dt=Math.min(.032,(t-lastT)/1000||.016); lastT=t;
  physics(dt); draw();
  if(running) requestAnimationFrame(loop);
}

function setAction(action,val){ input[action]=val; }
document.querySelectorAll(".mobile-controls button").forEach(btn=>{
  const a=btn.dataset.action;
  ["pointerdown","touchstart"].forEach(ev=>btn.addEventListener(ev,e=>{e.preventDefault();setAction(a,true);}));
  ["pointerup","pointercancel","pointerleave","touchend"].forEach(ev=>btn.addEventListener(ev,e=>{e.preventDefault();setAction(a,false);}));
});
window.addEventListener("keydown",e=>{
  if(["ArrowUp","d","D"].includes(e.key)) input.gas=true;
  if(["ArrowDown","s","S"].includes(e.key)) input.brake=true;
  if(["ArrowLeft","a","A"].includes(e.key)) input.leanLeft=true;
  if(["ArrowRight","w","W"].includes(e.key)) input.leanRight=true;
});
window.addEventListener("keyup",e=>{
  if(["ArrowUp","d","D"].includes(e.key)) input.gas=false;
  if(["ArrowDown","s","S"].includes(e.key)) input.brake=false;
  if(["ArrowLeft","a","A"].includes(e.key)) input.leanLeft=false;
  if(["ArrowRight","w","W"].includes(e.key)) input.leanRight=false;
});

$("#loadBtn").addEventListener("click",()=>{ resize(); loadData(); });
resize(); loadData();
