const $=s=>document.querySelector(s),canvas=$("#c"),ctx=canvas.getContext("2d"),sel=$("#stock"),msg=$("#msg");
let stocks=[],current=null,W=0,H=0,dpr=1,data=[],terrain=[],lines=[],cam=0,last=0,run=false;
let bike={x:70,y:200,vy:0,a:0,av:0,speed:130,ground:true,score:0};const key={gas:false,brake:false,left:false,right:false};

let installPrompt=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#install").hidden=false});
$("#install").onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#install").hidden=true}};
if("serviceWorker" in navigator)navigator.serviceWorker.register("./service-worker.js").catch(()=>{});

function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);W=Math.max(320,r.width);H=Math.max(320,r.height);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener("resize",resize);resize();

async function boot(){
  try{
    const r=await fetch("./data/stocks.json?v="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error("stocks.json not found");
    stocks=await r.json();
    if(stocks.length!==100)throw new Error("Archive does not contain 100 ranked stocks");
    sel.innerHTML="";
    for(const s of stocks){const o=document.createElement("option");o.value=s.symbol;o.textContent=`#${s.rank} ${s.name || s.symbol} (${s.symbol}) — ${s.volatility_pct.toFixed(1)}% vol`;sel.appendChild(o)}
    await load();
  }catch(e){
    msg.innerHTML=`<div>Stock archive has not been generated yet.<br><small>Go to GitHub → Actions → <b>Build 100-stock archive</b> → Run workflow once.<br>${e.message}</small></div>`;
  }
}
async function load(){
  run=false;msg.classList.remove("hidden");msg.textContent="Loading real 1-year chart…";
  try{
    current=stocks.find(s=>s.symbol===sel.value)||stocks[0];
    const r=await fetch(`./data/${current.symbol}.json?v=${Date.now()}`,{cache:"no-store"});
    if(!r.ok)throw new Error("Historical file missing for "+current.symbol);
    data=await r.json();if(data.length<100)throw new Error("Insufficient 1-year history");
    build();reset();msg.classList.add("hidden");run=true;last=performance.now();requestAnimationFrame(loop);
  }catch(e){msg.innerHTML=`<div>Could not load this chart.<br><small>${e.message}</small></div>`}
}
function build(){
  const vals=data.map(x=>x.close),lo=Math.min(...vals),hi=Math.max(...vals),span=Math.max(.001,hi-lo),dw=88;
  terrain=data.map((d,i)=>({x:i*dw,y:H*.79-((d.close-lo)/span)*H*.48,...d}));lines=[];terrain.forEach(p=>lines.push(p.x,p.x+dw/2));
  $("#hrank").textContent="#"+current.rank;$("#hvol").textContent=current.volatility_pct.toFixed(1)+"%";$("#hdays").textContent=data.length;$("#hlines").textContent=lines.length;
}
function reset(){bike={x:65,y:ty(65)-18,vy:0,a:0,av:0,speed:130,ground:true,score:0};cam=0;$("#hscore").textContent="0"}
function ty(x){if(!terrain.length)return H*.7;const dw=88;x=Math.max(0,Math.min(x,terrain.at(-1).x));const i=Math.min(terrain.length-2,Math.max(0,Math.floor(x/dw))),a=terrain[i],b=terrain[i+1]||a,t=(x-a.x)/Math.max(1,b.x-a.x),s=t*t*(3-2*t);return a.y+(b.y-a.y)*s}
function slope(x){return Math.atan2(ty(x+4)-ty(x-4),8)}function norm(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
function phys(dt){
 if(key.gas)bike.speed+=105*dt;if(key.brake)bike.speed-=150*dt;bike.speed*=Math.pow(.994,dt*60);bike.speed=Math.max(35,Math.min(275,bike.speed));bike.x+=bike.speed*dt;
 const gy=ty(bike.x),sl=slope(bike.x);if(bike.y+18>=gy-1&&bike.vy>=-45){if(!bike.ground)bike.score+=Math.round(Math.max(0,1-Math.abs(norm(bike.a-sl))/1.2)*170);bike.ground=true;bike.y=gy-18;bike.vy=0;bike.a+=norm(sl-bike.a)*Math.min(1,dt*9);bike.av*=.7;if(ty(bike.x+30)-gy>25&&bike.speed>95){bike.ground=false;bike.vy=-38}}else{bike.ground=false;bike.vy+=490*dt;bike.y+=bike.vy*dt;if(key.left)bike.av-=4.4*dt;if(key.right)bike.av+=4.4*dt;bike.a+=bike.av;bike.av*=Math.pow(.985,dt*60)}
 if(bike.ground){if(key.left)bike.a-=1.8*dt;if(key.right)bike.a+=1.8*dt}
 const max=terrain.at(-1).x;if(bike.x>=max-8){bike.x=max-8;bike.speed=0;run=false;msg.textContent=`Finished — score ${bike.score}`;msg.classList.remove("hidden")}
 cam+=((bike.x-W*.27)-cam)*Math.min(1,dt*4.5);cam=Math.max(0,Math.min(cam,Math.max(0,max-W)));$("#hscore").textContent=bike.score;
 const i=Math.max(0,Math.min(data.length-1,Math.round(bike.x/88)));$("#hp").textContent="₹"+Number(data[i].close).toLocaleString("en-IN",{maximumFractionDigits:2});$("#hd").textContent=new Date(data[i].date+"T00:00:00Z").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function draw(){
 ctx.clearRect(0,0,W,H);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#0c1119");g.addColorStop(1,"#06080c");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(-cam,0);const L=cam-2,R=cam+W+2;
 ctx.strokeStyle="rgba(255,255,255,.15)";ctx.lineWidth=1;ctx.beginPath();for(const x of lines)if(x>=L&&x<=R){ctx.moveTo(Math.round(x)+.5,0);ctx.lineTo(Math.round(x)+.5,H)}ctx.stroke();
 ctx.beginPath();ctx.moveTo(terrain[0].x,H);for(const p of terrain)ctx.lineTo(p.x,p.y);ctx.lineTo(terrain.at(-1).x,H);ctx.closePath();let fg=ctx.createLinearGradient(0,H*.25,0,H);fg.addColorStop(0,"rgba(117,230,173,.17)");fg.addColorStop(1,"rgba(117,230,173,.01)");ctx.fillStyle=fg;ctx.fill();
 ctx.beginPath();ctx.moveTo(terrain[0].x,terrain[0].y);for(const p of terrain)ctx.lineTo(p.x,p.y);ctx.strokeStyle="#75e6ad";ctx.lineWidth=3;ctx.lineJoin="round";ctx.stroke();drawBike();ctx.restore()
}
function drawBike(){ctx.save();ctx.translate(bike.x,bike.y);ctx.rotate(bike.a);ctx.strokeStyle="#f8fafc";ctx.lineWidth=2;for(const x of [-13,13]){ctx.beginPath();ctx.arc(x,12,8,0,Math.PI*2);ctx.stroke()}ctx.strokeStyle="#67e8f9";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-13,12);ctx.lineTo(-3,-3);ctx.lineTo(13,12);ctx.lineTo(4,0);ctx.lineTo(-13,12);ctx.stroke();ctx.fillStyle="#f8fafc";ctx.beginPath();ctx.arc(4,-14,5,0,Math.PI*2);ctx.fill();ctx.restore()}
function loop(t){if(!run)return;const dt=Math.min(.032,(t-last)/1000||.016);last=t;phys(dt);draw();if(run)requestAnimationFrame(loop)}
$("#go").onclick=load;$("#random").onclick=()=>{if(!stocks.length)return;sel.value=stocks[Math.floor(Math.random()*stocks.length)].symbol;load()};
document.querySelectorAll(".mobile button").forEach(b=>{const k=b.dataset.k;["pointerdown","touchstart"].forEach(ev=>b.addEventListener(ev,e=>{e.preventDefault();key[k]=true}));["pointerup","pointercancel","pointerleave","touchend"].forEach(ev=>b.addEventListener(ev,e=>{e.preventDefault();key[k]=false}))});
addEventListener("keydown",e=>{if(["ArrowUp","d","D"].includes(e.key))key.gas=true;if(["ArrowDown","s","S"].includes(e.key))key.brake=true;if(["ArrowLeft","a","A"].includes(e.key))key.left=true;if(["ArrowRight","w","W"].includes(e.key))key.right=true});
addEventListener("keyup",e=>{if(["ArrowUp","d","D"].includes(e.key))key.gas=false;if(["ArrowDown","s","S"].includes(e.key))key.brake=false;if(["ArrowLeft","a","A"].includes(e.key))key.left=false;if(["ArrowRight","w","W"].includes(e.key))key.right=false});
boot();
