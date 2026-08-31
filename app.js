const $=s=>document.querySelector(s);
const canvas=$("#gameCanvas"), ctx=canvas.getContext("2d");
const stockSelect=$("#stockSelect"), loadBtn=$("#loadBtn"), playBtn=$("#playBtn"), randomBtn=$("#randomBtn");
const messageBox=$("#messageBox"), overlayPlay=$("#overlayPlay"), overlayPlayBtn=$("#overlayPlayBtn");
const leftRideBtn=$("#leftRideBtn"), rightRideBtn=$("#rightRideBtn");

let installPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn").hidden=false;});
$("#installBtn").onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installBtn").hidden=true;}};

if("serviceWorker" in navigator){navigator.serviceWorker.register("./service-worker.js").catch(()=>{});}

let stocks=[], currentMeta=null, data=[], terrain=[], sessionLines=[];
let W=0,H=0,dpr=1, camX=0, animation=0, lastT=0;
let status="boot"; // boot, loaded, playing, finished
let bike={x:0,y:0,vy:0,angle:0,av:0,speed:0,onGround:true,score:0};

const input={right:false,left:false};

function resize(){
  const rect=canvas.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(320, Math.floor(rect.width));
  H=Math.max(360, Math.floor(rect.height));
  canvas.width=W*dpr; canvas.height=H*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize", resize);

function setMessage(text, visible=true){
  messageBox.innerHTML=text;
  messageBox.classList.toggle("hidden", !visible);
}
function fmtPrice(v){return "₹"+Number(v).toLocaleString("en-IN",{maximumFractionDigits:2});}

async function boot(){
  resize();
  try{
    const res=await fetch("./data/stocks.json?v="+Date.now(), {cache:"no-store"});
    if(!res.ok) throw new Error("stocks.json not found");
    stocks=await res.json();
    if(!Array.isArray(stocks) || !stocks.length) throw new Error("stock archive empty");
    stockSelect.innerHTML="";
    for(const s of stocks){
      const opt=document.createElement("option");
      opt.value=s.symbol;
      opt.textContent=`#${s.rank} ${s.name || s.symbol} (${s.symbol}) — ${Number(s.volatility_pct).toFixed(1)}%`;
      stockSelect.appendChild(opt);
    }
    currentMeta=stocks[0];
    $("#selectedTop").textContent=currentMeta.symbol;
    status="loaded";
    setMessage("Choose a stock and press <b>Load track</b>.", true);
  }catch(err){
    setMessage(`Stock archive not found.<br><small>Go to GitHub Actions and run the 100-stock build once.<br>${err.message}</small>`, true);
  }
}
stockSelect.addEventListener("change", ()=>{
  currentMeta = stocks.find(s=>s.symbol===stockSelect.value) || null;
  if(currentMeta){ $("#selectedTop").textContent=currentMeta.symbol; }
});

randomBtn.addEventListener("click", ()=>{
  if(!stocks.length) return;
  const pick = stocks[Math.floor(Math.random()*stocks.length)];
  stockSelect.value = pick.symbol;
  currentMeta = pick;
  $("#selectedTop").textContent=currentMeta.symbol;
});

loadBtn.addEventListener("click", loadTrack);
playBtn.addEventListener("click", startGame);
overlayPlayBtn.addEventListener("click", startGame);

async function loadTrack(){
  if(!stocks.length){ return; }
  if(!currentMeta){ currentMeta = stocks.find(s=>s.symbol===stockSelect.value) || stocks[0]; }
  status="loading";
  playBtn.disabled=true;
  overlayPlay.classList.add("hidden");
  setMessage("Loading stored real 1-year chart…", true);
  try{
    const res=await fetch(`./data/${currentMeta.symbol}.json?v=${Date.now()}`, {cache:"no-store"});
    if(!res.ok) throw new Error(`Missing JSON for ${currentMeta.symbol}`);
    data=await res.json();
    if(!Array.isArray(data) || data.length<100) throw new Error("Not enough history to build a full track");
    buildTerrain();
    updateMetaPanels();
    resetGame();
    status="loaded";
    playBtn.disabled=false;
    setMessage(`Track ready for <b>${currentMeta.symbol}</b>.<br>Press <b>Play</b> to start riding.`, true);
    overlayPlay.classList.remove("hidden");
    draw();
  }catch(err){
    status="error";
    setMessage(`Could not load this chart.<br><small>${err.message}</small>`, true);
  }
}

function buildTerrain(){
  const vals=data.map(d=>Number(d.close)).filter(Number.isFinite);
  const lo=Math.min(...vals), hi=Math.max(...vals), span=Math.max(.001, hi-lo);
  const dayWidth=88;
  terrain=data.map((d,i)=>{
    const close=Number(d.close);
    const norm=(close-lo)/span;
    const y=H*0.79 - norm*H*0.48;
    return {x:i*dayWidth, y, ...d, close};
  });
  sessionLines=[];
  for(const p of terrain){
    sessionLines.push(p.x, p.x + dayWidth/2);
  }
  $("#chartTitle").textContent = `${currentMeta.symbol} · 1-year track`;
  $("#chartSub").textContent = `Real stored chart · ${terrain.length} trading sessions · ${sessionLines.length} white half-day lines`;
}
function updateMetaPanels(){
  $("#rankValue").textContent = "#"+currentMeta.rank;
  $("#volValue").textContent = Number(currentMeta.volatility_pct).toFixed(1) + "%";
  $("#daysValue").textContent = String(terrain.length);
  $("#tradingDaysValue").textContent = String(terrain.length);
  $("#lineCountValue").textContent = String(sessionLines.length);
}
function resetGame(){
  bike={
    x:65,
    y:terrainY(65)-18,
    vy:0,
    angle:0,
    av:0,
    speed:0,
    onGround:true,
    score:0
  };
  camX=0;
  $("#scoreValue").textContent="0";
  updateHUDFromBike();
}
function startGame(){
  if(status!=="loaded" && status!=="finished") return;
  resetGame();
  status="playing";
  overlayPlay.classList.add("hidden");
  setMessage("", false);
  bike.speed=126;
  lastT=performance.now();
  cancelAnimationFrame(animation);
  animation=requestAnimationFrame(loop);
}
function terrainY(x){
  if(!terrain.length) return H*.75;
  const dayWidth=88;
  x=Math.max(0, Math.min(x, terrain[terrain.length-1].x));
  const i=Math.min(terrain.length-2, Math.max(0, Math.floor(x/dayWidth)));
  const a=terrain[i], b=terrain[i+1]||a;
  const t=(x-a.x)/Math.max(1,b.x-a.x);
  const s=t*t*(3-2*t);
  return a.y + (b.y-a.y)*s;
}
function terrainSlope(x){
  return Math.atan2(terrainY(x+4)-terrainY(x-4),8);
}
function normalizeAngle(a){
  while(a>Math.PI) a-=Math.PI*2;
  while(a<-Math.PI) a+=Math.PI*2;
  return a;
}
function updateHUDFromBike(){
  if(!data.length) return;
  const idx=Math.max(0, Math.min(data.length-1, Math.round(bike.x/88)));
  const row=data[idx];
  $("#priceValue").textContent = fmtPrice(row.close);
  $("#dateValue").textContent = new Date(row.date+"T00:00:00Z").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  $("#scoreValue").textContent = String(Math.round(bike.score));
}
function physics(dt){
  if(input.right){
    bike.speed += 105*dt;
    if(bike.onGround) bike.angle += 1.1*dt;
    else bike.av += 3.8*dt;
  }
  if(input.left){
    bike.speed -= 145*dt;
    if(bike.onGround) bike.angle -= 1.2*dt;
    else bike.av -= 4.1*dt;
  }
  bike.speed *= Math.pow(.994, dt*60);
  bike.speed = Math.max(-10, Math.min(278, bike.speed));
  bike.x += bike.speed*dt;

  const gy=terrainY(bike.x), slope=terrainSlope(bike.x);

  if(bike.y+18 >= gy-1 && bike.vy >= -45){
    if(!bike.onGround){
      const landing = Math.max(0, 1 - Math.abs(normalizeAngle(bike.angle-slope))/1.2);
      bike.score += Math.round(landing*175 + Math.max(0,bike.speed-95)*.12);
    }
    bike.onGround = true;
    bike.y = gy-18;
    bike.vy = Math.min(0,bike.vy)*0;
    bike.angle += normalizeAngle(slope-bike.angle)*Math.min(1, dt*9);
    bike.av *= .7;
    if(terrainY(bike.x+30)-gy > 24 && bike.speed > 92){
      bike.onGround = false;
      bike.vy = -37;
    }
  } else {
    bike.onGround = false;
    bike.vy += 490*dt;
    bike.y += bike.vy*dt;
    bike.angle += bike.av;
    bike.av *= Math.pow(.985, dt*60);
    bike.score += Math.max(0, bike.speed*.005);
  }

  const maxX=terrain[terrain.length-1].x;
  if(bike.x >= maxX-8){
    bike.x=maxX-8;
    bike.speed=0;
    status="finished";
    overlayPlay.classList.remove("hidden");
    setMessage(`Run finished.<br><small>Score: ${Math.round(bike.score)} · Press Play to ride again.</small>`, true);
  }

  camX += ((bike.x - W*.30) - camX) * Math.min(1, dt*4.7);
  camX = Math.max(0, Math.min(camX, Math.max(0, maxX-W)));

  updateHUDFromBike();
}
function drawBackground(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#0b1017");
  g.addColorStop(1,"#05080d");
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);
}
function drawChart(){
  ctx.save();
  ctx.translate(-camX, 0);

  const left=camX-2, right=camX+W+2;

  // subtle chart grid
  ctx.strokeStyle="rgba(255,255,255,.05)";
  ctx.lineWidth=1;
  ctx.beginPath();
  for(let y=40;y<H;y+=56){
    ctx.moveTo(left,y); ctx.lineTo(right,y);
  }
  ctx.stroke();

  // half-session vertical markers: exactly 2 per trading day
  ctx.strokeStyle="rgba(255,255,255,.15)";
  ctx.lineWidth=1;
  ctx.beginPath();
  for(const x of sessionLines){
    if(x<left || x>right) continue;
    ctx.moveTo(Math.round(x)+.5,0);
    ctx.lineTo(Math.round(x)+.5,H);
  }
  ctx.stroke();

  // area fill
  ctx.beginPath();
  ctx.moveTo(terrain[0].x,H);
  for(const p of terrain){ ctx.lineTo(p.x,p.y); }
  ctx.lineTo(terrain[terrain.length-1].x,H);
  ctx.closePath();
  const fill=ctx.createLinearGradient(0,H*.25,0,H);
  fill.addColorStop(0,"rgba(117,230,173,.22)");
  fill.addColorStop(1,"rgba(117,230,173,.02)");
  ctx.fillStyle=fill;
  ctx.fill();

  // line
  ctx.beginPath();
  ctx.moveTo(terrain[0].x,terrain[0].y);
  for(const p of terrain){ ctx.lineTo(p.x,p.y); }
  ctx.strokeStyle="#76f0c7";
  ctx.lineWidth=3;
  ctx.lineJoin="round";
  ctx.lineCap="round";
  ctx.stroke();

  // last-price line
  ctx.strokeStyle="rgba(255,109,109,.55)";
  ctx.setLineDash([6,6]);
  ctx.beginPath();
  const y=terrainY(bike.x);
  ctx.moveTo(left,y); ctx.lineTo(right,y);
  ctx.stroke();
  ctx.setLineDash([]);

  drawBike();
  ctx.restore();
}
function drawBike(){
  ctx.save();
  ctx.translate(bike.x,bike.y);
  ctx.rotate(bike.angle);

  ctx.strokeStyle="#f8fafc";
  ctx.lineWidth=2;
  for(const x of [-14,14]){
    ctx.beginPath(); ctx.arc(x,12,8,0,Math.PI*2); ctx.stroke();
  }

  ctx.strokeStyle="#67e8f9";
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(-14,12);
  ctx.lineTo(-4,-2);
  ctx.lineTo(14,12);
  ctx.lineTo(5,0);
  ctx.lineTo(-14,12);
  ctx.stroke();

  ctx.fillStyle="#f8fafc";
  ctx.beginPath();
  ctx.arc(5,-14,5,0,Math.PI*2);
  ctx.fill();

  ctx.restore();
}
function draw(){
  drawBackground();
  if(terrain.length){ drawChart(); }
}
function loop(t){
  if(status!=="playing"){
    draw();
    cancelAnimationFrame(animation);
    return;
  }
  const dt=Math.min(.032, ((t-lastT)/1000) || .016);
  lastT=t;
  physics(dt);
  draw();
  animation=requestAnimationFrame(loop);
}

function pressState(side, value){ input[side]=value; }
for(const eventName of ["pointerdown","touchstart"]){
  rightRideBtn.addEventListener(eventName,e=>{e.preventDefault(); pressState("right",true);});
  leftRideBtn.addEventListener(eventName,e=>{e.preventDefault(); pressState("left",true);});
}
for(const eventName of ["pointerup","pointercancel","pointerleave","touchend"]){
  rightRideBtn.addEventListener(eventName,e=>{e.preventDefault(); pressState("right",false);});
  leftRideBtn.addEventListener(eventName,e=>{e.preventDefault(); pressState("left",false);});
}

window.addEventListener("keydown",e=>{
  if(["ArrowRight","d","D","w","W","ArrowUp"].includes(e.key)) input.right=true;
  if(["ArrowLeft","a","A","s","S","ArrowDown"].includes(e.key)) input.left=true;
});
window.addEventListener("keyup",e=>{
  if(["ArrowRight","d","D","w","W","ArrowUp"].includes(e.key)) input.right=false;
  if(["ArrowLeft","a","A","s","S","ArrowDown"].includes(e.key)) input.left=false;
});

boot();
