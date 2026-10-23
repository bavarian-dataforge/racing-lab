(()=>{'use strict';
const $=id=>document.getElementById(id),cv=$('race'),ctx=cv.getContext('2d'),hc=$('history'),hx=hc.getContext('2d');cv.width=1200;cv.height=800;hc.width=440;hc.height=120;const focus=$('car-focus'),fx=focus.getContext('2d');let collision=null;
const baseNodes=[[260,630],[130,480],[160,250],[340,155],[620,155],[790,270],[1030,200],[1080,420],[900,610],[670,620],[530,450],[390,520]];
const courses={
  training:{name:'Testkurs 01 · Trainingsstrecke',nodes:baseNodes},
  curves:{name:'Testkurs 02 · Wechselkurven',nodes:[[260,630],[130,480],[160,285],[330,165],[540,180],[685,300],[850,175],[1050,260],[1060,470],[900,635],[705,510],[480,635]]},
  oval:{name:'Testkurs 03 · Weite Bögen',nodes:[[280,620],[145,490],[130,300],[270,170],[480,135],[720,135],[940,180],[1070,315],[1050,500],[890,635],[675,670],[455,660]]},
  hairpin:{name:'Testkurs 04 · Enge Kurven',nodes:[[200,640],[125,450],[150,180],[380,150],[410,390],[570,400],[620,170],[1020,160],[1080,450],[920,650],[670,620],[440,610]]},
  reverse:{name:'Testkurs 05 · Gegenrichtung',nodes:[baseNodes[0],...baseNodes.slice(1).reverse()]}
};
let trackId='training',pts=[],M=0,ds=[],total=0,edges=[];
const wrap=i=>(i%M+M)%M;
function buildTrack(id){trackId=id;const nodes=courses[id].nodes,N=nodes.length;pts=[];edges=[];ds=[0];total=0;
for(let j=0;j<N;j++)for(let q=0;q<24;q++){let t=q/24,a=nodes[(j+N-1)%N],b=nodes[j],c=nodes[(j+1)%N],d=nodes[(j+2)%N];pts.push([0,1].map(k=>.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)));}
M=pts.length;
for(let i=0;i<M;i++){const p=pts[i],n=pts[wrap(i+1)],prev=pts[wrap(i-1)],dx=n[0]-prev[0],dy=n[1]-prev[1],l=Math.hypot(dx,dy);edges.push([[p[0]-dy/l*30,p[1]+dx/l*30],[p[0]+dy/l*30,p[1]-dx/l*30]]);total+=Math.hypot(n[0]-p[0],n[1]-p[1]);ds.push(total);}
$('courseCaption').textContent=courses[id].name.toUpperCase()+' · VOGELPERSPEKTIVE';
$('toggle').disabled=id!=='training';$('courseNotice').textContent=id==='training'?'Training und unveränderte Testfahrten verfügbar.':'Prüfstrecke: Der gespeicherte Fahrer fährt ohne weiteres Lernen. Sein Trainingsstand bleibt erhalten.';
}
buildTrack('training');const trainingLength=total;
const angles=[-1.55,-1.05,-.5,0,.5,1.05,1.55],W=122,rand=()=>Math.random()*2-1;let incumbent=null,bestScore=-Infinity,bestProgress=0,attempt=1,history=[],running=false,testMode=false,car,weights,status='Bereit',acc=0,last=0,steer=0,pedal=0;
let activations={input:Array(9).fill(0),hidden:Array(10).fill(0),output:[0,0]},records=[],samples=[],connections=[],lastSample=-1;let testResults=[];
const checkpointKey='racing-lab-single-driver-v1';
function saveCheckpoint(){
  if(!incumbent)return;
  try{localStorage.setItem(checkpointKey,JSON.stringify({version:1,attempt,bestScore,bestProgress,incumbent,history:history.slice(-180),records:records.slice(-200),samples:samples.slice(-1000),testResults:testResults.slice(-50)}));
    $('storageStatus').textContent='✓ Bester Fahrer und letzte 200 Versuche automatisch in diesem Browser gespeichert.';
  }catch(e){$('storageStatus').textContent='Automatisches Speichern nicht verfügbar. Bitte JSON exportieren.';}
}
function restoreCheckpoint(){
  try{const raw=localStorage.getItem(checkpointKey);if(!raw)return false;const data=JSON.parse(raw);
    if(data.version!==1||!Array.isArray(data.incumbent)||data.incumbent.length!==W||!data.incumbent.every(v=>Number.isFinite(v))||!Number.isFinite(data.bestScore)||!Number.isFinite(data.bestProgress)||!Number.isSafeInteger(data.attempt)||data.attempt<2)return false;
    incumbent=data.incumbent.slice();bestScore=data.bestScore;bestProgress=Math.max(0,Math.min(trainingLength,data.bestProgress));attempt=data.attempt;history=Array.isArray(data.history)?data.history.filter(Number.isFinite).slice(-180):[];records=Array.isArray(data.records)?data.records.slice(-200):[];samples=Array.isArray(data.samples)?data.samples.slice(-1000):[];testResults=Array.isArray(data.testResults)?data.testResults.slice(-50):[];
    $('logCount').textContent=records.length+' gespeicherte Versuche';$('storageStatus').textContent='✓ Gespeichertes Training geladen. Der nächste Versuch baut auf dem besten Fahrer auf.';
    $('status').textContent='Bester Fahrer geladen · Training kann weitergehen.';return true;
  }catch(e){$('storageStatus').textContent='Gespeicherter Stand konnte nicht gelesen werden. Bitte JSON exportieren.';return false;}
}
function fresh(){return Array.from({length:W},()=>rand()*.8)}
function mutate(base){let scale=Math.random()<.12?.7:.12+Math.random()*.2;return base.map(v=>Math.random()<.65?v+rand()*scale:v)}
function makeCar(offset=0,headingOffset=0){const p=pts[0],n=pts[1],a=Math.atan2(n[1]-p[1],n[0]-p[0]);return {x:p[0]-Math.sin(a)*offset,y:p[1]+Math.cos(a)*offset,a:a+headingOffset,v:0,omega:0,i:0,progress:0,max:0,time:0,stall:0,sensors:[],trail:[],sampleTick:-1};}
function startCar(w){weights=w;lastSample=-1;car=makeCar();}
function nearest(x,y,center,range){let best=null;for(let k=center-range;k<=center+range;k++){let i=wrap(k),p=pts[i],q=pts[wrap(i+1)],dx=q[0]-p[0],dy=q[1]-p[1],t=Math.max(0,Math.min(1,((x-p[0])*dx+(y-p[1])*dy)/(dx*dx+dy*dy))),d=Math.hypot(x-p[0]-t*dx,y-p[1]-t*dy);if(!best||d<best.d)best={i,d,s:ds[i]+t*Math.hypot(dx,dy)};}return best;}
function sense(c){return angles.map(angle=>{const dx=Math.cos(c.a+angle),dy=Math.sin(c.a+angle);let dist=180;for(let k=c.i-34;k<c.i+34;k++)for(let side=0;side<2;side++){let p=edges[wrap(k)][side],q=edges[wrap(k+1)][side],sx=q[0]-p[0],sy=q[1]-p[1],den=dx*sy-dy*sx;if(Math.abs(den)<1e-8)continue;const px=p[0]-c.x,py=p[1]-c.y,t=(px*sy-py*sx)/den,u=(px*dy-py*dx)/den;if(t>=0&&u>=0&&u<=1)dist=Math.min(dist,t);}return dist;});}
function predict(inputs,model=weights){let z=0,h=[];for(let j=0;j<10;j++){let v=model[z++];for(let i=0;i<9;i++)v+=model[z++]*inputs[i];h.push(Math.tanh(v));}const out=[0,1].map(()=>{let v=model[z++];for(let j=0;j<10;j++)v+=model[z++]*h[j];return Math.tanh(v)});activations={input:inputs.slice(),hidden:h,output:out};return out;}
function finish(reason){if(reason==='Wandkontakt')collision={x:car.x,y:car.y,until:Date.now()+850};const score=car.progress-car.time*.6+(car.progress>=total?500:0);if(!testMode){const improved=score>bestScore;records.push({attempt,score,reason,improved,time:car.time,progress:car.progress,weights:weights.slice(),deltaFromBest:incumbent?weights.map((w,i)=>w-incumbent[i]):null});$('logCount').textContent=records.length+' protokollierte Versuche';if(improved){bestScore=score;incumbent=weights.slice();bestProgress=Math.max(bestProgress,car.max);status='Verbesserung gespeichert · '+reason;}else status='Neuer Versuch · '+reason;history.push(bestScore);if(history.length>180)history.shift();attempt++;saveCheckpoint();startCar(Math.random()<.05?fresh():mutate(incumbent));}else{running=false;recordTest(car,reason,'Einzelwagen');status='Test beendet · '+reason;}$('status').textContent=status;}
function advance(c,model,driverId=1){const dt=1/60;c.sensors=sense(c);const action=predict([...c.sensors.map(v=>v/180),c.v/160,c.omega/4],model);[steer,pedal]=action;c.v=Math.max(0,Math.min(170,c.v+(pedal*(pedal>0?85:140)-.13*c.v)*dt));c.omega=c.v/22*Math.tan(steer*.52);c.a+=c.omega*dt;c.x+=Math.cos(c.a)*c.v*dt;c.y+=Math.sin(c.a)*c.v*dt;c.time+=dt;if(Math.floor(c.time*5)!==c.sampleTick){c.sampleTick=Math.floor(c.time*5);samples.push({attempt,testMode,trackId,driverId,time:c.time,inputs:activations.input.slice(),hidden:activations.hidden.slice(),outputs:activations.output.slice()});if(samples.length>10000)samples.shift();}
const previous=c.trail.length?c.trail[c.trail.length-1]:pts[0],old=nearest(previous[0],previous[1],c.i,5),n=nearest(c.x,c.y,c.i,7);let delta=n.s-old.s;if(delta<-total/2)delta+=total;if(delta>total/2)delta-=total;c.progress+=delta;c.i=n.i;if(c.progress>c.max+.05){c.max=c.progress;c.stall=0}else c.stall+=dt;c.trail.push([c.x,c.y]);if(c.trail.length>160)c.trail.shift();if(n.d>23)return 'Wandkontakt';if(c.progress>=total)return 'Runde geschafft!';if(c.stall>3)return 'Kein Fortschritt';if(c.time>70)return 'Zeitlimit';return null;}
function recordTest(c,reason,driver){const result={trackId,course:courses[trackId].name,driver,progressPercent:Math.max(0,Math.min(100,c.max/total*100)),time:c.time,completed:reason==='Runde geschafft!',reason,weightsUnchanged:true};testResults.push(result);if(testResults.length>50)testResults.shift();showTestResults();saveCheckpoint();return result;}
function showTestResults(){const valid=testResults.filter(r=>r&&courses[r.trackId]&&typeof r.driver==='string'&&Number.isFinite(r.progressPercent)&&Number.isFinite(r.time));$('transferResults').textContent=valid.slice(-10).map(r=>r.course+' | '+r.driver+' | '+r.progressPercent.toFixed(1)+' % | '+r.time.toFixed(2)+' s | '+r.reason).join('\n')||'Noch keine Testfahrt abgeschlossen.';}
function step(){const reason=advance(car,weights);if(reason)finish(reason);}
function beginTest(){if(!incumbent){$('status').textContent='Zuerst einen Fahrer trainieren oder einen JSON-Stand laden.';return;}
running=true;testMode=true;collision=null;acc=0;startCar(incumbent.slice());$('status').textContent='Unverändertes bestes Netz auf '+courses[trackId].name+' · kein Lernen während des Tests.';}
function switchCourse(id){if(!courses[id])return;running=false;testMode=false;collision=null;acc=0;buildTrack(id);$('courseSelect').value=id;startCar(incumbent?incumbent.slice():fresh());try{localStorage.setItem('racing-lab-selected-course-v1',id)}catch(e){}$('status').textContent='Strecke gewechselt · „Besten Fahrer testen“ startet die Prüfung mit unveränderten Gewichten.';}
function path(){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();}
function paintCar(c,color){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);ctx.fillStyle='#15282c';for(const x of [-8,8])for(const y of [-5.5,5.5])ctx.fillRect(x-3,y-2,6,4);ctx.strokeStyle='#182b31';ctx.lineWidth=1.2;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(14,-1.8);ctx.lineTo(3,-3.6);ctx.lineTo(-6,-4);ctx.lineTo(-11,-3);ctx.lineTo(-11,3);ctx.lineTo(-6,4);ctx.lineTo(3,3.6);ctx.lineTo(14,1.8);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#ffcc68';ctx.fillRect(10,-5,3,10);ctx.fillStyle='#172e37';ctx.fillRect(-13,-5,3,10);ctx.fillStyle='#f8e8bd';ctx.beginPath();ctx.ellipse(-1,0,3,2.2,0,0,7);ctx.fill();ctx.restore();
}
function draw(){ctx.clearRect(0,0,1200,800);ctx.fillStyle='#bbce9c';ctx.fillRect(0,0,1200,800);for(let i=0;i<55;i++){let x=(i*193+50)%1200,y=(i*137+45)%800;if(nearest(x,y,0,M).d<53)continue;ctx.fillStyle='#8eaf76';ctx.beginPath();ctx.arc(x,y,7+i%5,0,7);ctx.fill();ctx.strokeStyle='#6f9363';ctx.lineWidth=2;ctx.stroke();}
ctx.lineJoin='round';path();ctx.strokeStyle='#243a3e';ctx.lineWidth=76;ctx.stroke();path();ctx.strokeStyle='#fff5dc';ctx.lineWidth=70;ctx.stroke();path();ctx.strokeStyle='#eb7658';ctx.lineWidth=70;ctx.setLineDash([12,12]);ctx.stroke();ctx.setLineDash([]);path();ctx.strokeStyle='#4a5c60';ctx.lineWidth=60;ctx.stroke();path();ctx.strokeStyle='#87908a';ctx.lineWidth=1;ctx.setLineDash([12,14]);ctx.stroke();ctx.setLineDash([]);
const p=pts[0],n=pts[1];ctx.save();ctx.translate(...p);ctx.rotate(Math.atan2(n[1]-p[1],n[0]-p[0]));for(let i=0;i<8;i++)for(let j=0;j<2;j++){ctx.fillStyle=(i+j)%2?'#fff9e8':'#26373a';ctx.fillRect(-5+j*5,-30+i*7.5,5,7.5)}ctx.restore();
if(car.trail.length){ctx.beginPath();car.trail.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle='#f6b66680';ctx.lineWidth=2;ctx.stroke();}if($('rays').checked){ctx.strokeStyle='#d7ed9bb0';ctx.lineWidth=1.5;car.sensors.forEach((d,i)=>{ctx.beginPath();ctx.moveTo(car.x,car.y);ctx.lineTo(car.x+Math.cos(car.a+angles[i])*d,car.y+Math.sin(car.a+angles[i])*d);ctx.stroke();});}
paintCar(car,'#fa7644');
// Draw the vehicle in a separate SVG layer so canvas redraws cannot cover it.
$('vehicle-position').setAttribute('transform',`translate(${car.x} ${car.y})`);
$('vehicle-heading').setAttribute('transform',`rotate(${car.a*180/Math.PI})`);
const marker=$('collision-marker');marker.setAttribute('visibility',collision&&Date.now()<collision.until?'visible':'hidden');if(collision)marker.setAttribute('transform',`translate(${collision.x} ${collision.y})`);
// The follow view stays beside the course, never over the road.
fx.clearRect(0,0,320,160);fx.fillStyle='#bbce9c';fx.fillRect(0,0,320,160);
const cropW=128,cropH=64,sx=Math.max(0,Math.min(1200-cropW,car.x-cropW/2)),sy=Math.max(0,Math.min(800-cropH,car.y-cropH/2));
fx.drawImage(cv,sx,sy,cropW,cropH,0,0,320,160);
$('attempt').textContent=attempt;$('speed').textContent=Math.round(car.v*.2*3.6)+' km/h';$('progress').textContent=Math.max(0,car.progress/total*100).toFixed(1)+' %';$('best').textContent=(bestProgress/trainingLength*100).toFixed(1)+' %';$('steer').textContent=steer.toFixed(2);$('pedal').textContent=pedal.toFixed(2);$('steerbar').style.width=(steer+1)*50+'%';$('pedalbar').style.width=(pedal+1)*50+'%';$('badge').textContent=running?(testMode?'● TESTFAHRT':'● TRAINING LÄUFT'):'● PAUSIERT';$('toggle').textContent=running?'Pause ❚❚':'Training starten ↗';hx.clearRect(0,0,440,120);if(history.length>1){const lo=Math.min(0,...history),hi=Math.max(10,...history);hx.beginPath();history.forEach((v,i)=>{let x=i/(history.length-1)*430+5,y=112-(v-lo)/(hi-lo)*102;i?hx.lineTo(x,y):hx.moveTo(x,y)});hx.strokeStyle='#ee7543';hx.lineWidth=3;hx.stroke();}}
$('courseSelect').onchange=e=>switchCourse(e.target.value);
$('toggle').onclick=()=>{if(trackId!=='training'){ $('status').textContent='Für weiteres Training zuerst die Trainingsstrecke wählen.';return;}if(testMode){testMode=false;startCar(incumbent?mutate(incumbent):fresh());running=true;}else running=!running;};
$('bestRun').onclick=()=>beginTest();
$('reset').onclick=()=>{switchCourse('training');running=false;testMode=false;collision=null;testResults=[];showTestResults();incumbent=null;bestScore=-Infinity;bestProgress=0;attempt=1;history=[];records=[];samples=[];$('logCount').textContent='0 protokollierte Versuche';try{localStorage.removeItem(checkpointKey)}catch(e){}$('storageStatus').textContent='Neues Training: gespeicherter Stand gelöscht.';startCar(fresh());$('status').textContent='Neues zufälliges Netz. Bereit für den ersten Versuch.';};restoreCheckpoint();showTestResults();startCar(incumbent?mutate(incumbent):fresh());try{const savedCourse=localStorage.getItem('racing-lab-selected-course-v1');if(savedCourse&&courses[savedCourse])switchCourse(savedCourse)}catch(e){}
const nc=$('network'),nx=nc.getContext('2d');nc.width=1100;nc.height=400;
function network(){nx.clearRect(0,0,1100,400);connections=[];const ys=(n,i)=>45+i*310/(n-1),xs=[210,570,920],layers=[activations.input,activations.hidden,activations.output],labels=['Abstand links','Schräg links','Vorne links','Vorne','Vorne rechts','Schräg rechts','Abstand rechts','Tempo','Drehrate'];let z=0;
function edge(a,b,w,label){nx.beginPath();nx.moveTo(...a);nx.lineTo(...b);nx.strokeStyle=w>=0?'rgba(235,104,57,.38)':'rgba(40,117,169,.38)';nx.lineWidth=.4+Math.min(3,Math.abs(w));nx.stroke();connections.push({a,b,w,label});}
for(let j=0;j<10;j++){z++;for(let i=0;i<9;i++)edge([xs[0],ys(9,i)],[xs[1],ys(10,j)],weights[z++],labels[i]+' → H'+(j+1));}for(let j=0;j<2;j++){z++;for(let i=0;i<10;i++)edge([xs[1],ys(10,i)],[xs[2],ys(2,j)],weights[z++],'H'+(i+1)+' → '+(j?'Fahrpedal':'Lenkung'));}
layers.forEach((layer,l)=>layer.forEach((v,i)=>{let x=xs[l],y=ys(layer.length,i);nx.beginPath();nx.arc(x,y,12,0,7);nx.fillStyle=v>=0?`rgba(244,115,65,${.15+.85*Math.min(1,Math.abs(v))})`:`rgba(40,117,169,${.15+.85*Math.min(1,Math.abs(v))})`;nx.fill();nx.strokeStyle='#20383c';nx.lineWidth=1.5;nx.stroke();nx.fillStyle='#20383c';nx.font='12px monospace';nx.textAlign=l===0?'right':'left';nx.fillText((l===0?labels[i]:l===1?'H'+(i+1):i?'Fahrpedal':'Lenkung')+' '+v.toFixed(2),x+(l===0?-20:20),y+4);}));nx.font='12px monospace';nx.textAlign='center';['9 EINGÄNGE','10 VERSTECKTE KNOTEN','2 AUSGÄNGE'].forEach((t,i)=>nx.fillText(t,xs[i],20));}
nc.onclick=e=>{const r=nc.getBoundingClientRect(),x=(e.clientX-r.left)*1100/r.width,y=(e.clientY-r.top)*400/r.height;let best=null;for(const c of connections){const dx=c.b[0]-c.a[0],dy=c.b[1]-c.a[1],t=Math.max(0,Math.min(1,((x-c.a[0])*dx+(y-c.a[1])*dy)/(dx*dx+dy*dy))),d=Math.hypot(x-c.a[0]-t*dx,y-c.a[1]-t*dy);if(!best||d<best.d)best={...c,d};}if(best&&best.d<18)$('weightDetail').textContent=best.label+' | Gewicht: '+best.w.toFixed(6)+' | Versuch '+attempt;};
function download(name,data,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
$('exportLog').onclick=()=>download('racing-training.json',JSON.stringify({formatVersion:1,algorithm:'sequential random mutation with elitist selection',architecture:[9,10,2],weightLayout:'hidden: bias then 9 inputs per neuron; output: bias then 10 hidden per neuron',reward:'progress - 0.6*time + 500 for completed lap',sensorRange:180,track:pts,trackId,courseProfiles:Object.entries(courses).map(([id,c])=>({id,name:c.name,nodes:c.nodes})),trainingTrackId:'training',bestProgress,trainingLength,testResults,bestScore:Number.isFinite(bestScore)?bestScore:null,bestWeights:incumbent,currentWeights:weights,records,samples},null,2),'application/json');
$('exportCsv').onclick=()=>download('racing-versuche.csv','attempt,score,time,progress,improved,reason\n'+records.map(r=>[r.attempt,r.score,r.time,r.progress,r.improved,r.reason].join(',')).join('\n'),'text/csv');
$('importLog').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const data=JSON.parse(await file.text());
    if(data.formatVersion!==1||JSON.stringify(data.architecture)!=='[9,10,2]'||!Array.isArray(data.bestWeights)||data.bestWeights.length!==W||!data.bestWeights.every(Number.isFinite)||!Number.isFinite(data.bestScore))throw Error('Datei enthält keinen gültigen trainierten Fahrer.');
    const restoredRecords=Array.isArray(data.records)?data.records.filter(r=>r&&Number.isSafeInteger(r.attempt)&&Number.isFinite(r.score)&&Number.isFinite(r.progress)&&Number.isFinite(r.time)).slice(-200):[];
    const restoredSamples=Array.isArray(data.samples)?data.samples.slice(-1000):[];
    switchCourse('training');incumbent=data.bestWeights.slice();bestScore=data.bestScore;records=restoredRecords;samples=restoredSamples;testResults=Array.isArray(data.testResults)?data.testResults.slice(-50):[];showTestResults();
    bestProgress=Number.isFinite(data.bestProgress)?Math.max(0,Math.min(trainingLength,data.bestProgress)):Math.max(0,...records.filter(r=>r.improved).map(r=>Math.min(trainingLength,r.progress)));
    attempt=records.length?Math.max(...records.map(r=>r.attempt))+1:2;
    history=[];running=false;testMode=false;collision=null;startCar(mutate(incumbent));saveCheckpoint();
    $('logCount').textContent=records.length+' importierte Versuche';$('status').textContent='Fahrer aus JSON geladen · Training fortsetzen.';
  }catch(err){$('status').textContent='Import fehlgeschlagen: '+err.message;}
  e.target.value='';
};
function frame(t){if(last&&running){acc+=Math.min((t-last)/1000,.1)*Number($('rate').value);let count=0;while(acc>=1/60&&count++<180&&running){step();acc-=1/60}}else acc=0;last=t;draw();network();requestAnimationFrame(frame)}requestAnimationFrame(frame);
// Exposes deterministic stepping for local verification; no external services.
window.racingLab={step,reset:()=>{$('reset').onclick()},switchCourse,beginTest,courseProfiles:()=>JSON.parse(JSON.stringify(courses)),stats:()=>({trackId,running,testMode,incumbent:incumbent?.slice(),testResults:testResults.slice(),attempt,bestScore,bestProgress,total,history:history.slice(),car:{...car},weights:weights.slice()})};
})();
