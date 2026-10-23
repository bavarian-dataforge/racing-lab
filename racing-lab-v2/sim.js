// Racing Lab v2 – Population (genetischer Algorithmus), Nürburgring, mehrere Fahrer.
// Fahrphysik, Sensoren, Netz und Bewertung sind bewusst identisch mit v1, damit
// ein in v1 trainierter Fahrer hier unverändert weiterfährt.
(()=>{'use strict';
const $=id=>document.getElementById(id);
const cv=$('race'),ctx=cv.getContext('2d'),hc=$('history'),hx=hc.getContext('2d'),focus=$('car-focus'),fx=focus.getContext('2d');
cv.width=1200;cv.height=800;hc.width=440;hc.height=120;

// ---------- Strecken ----------
const baseNodes=[[260,630],[130,480],[160,250],[340,155],[620,155],[790,270],[1030,200],[1080,420],[900,610],[670,620],[530,450],[390,520]];
const courses={
  training:{name:'Testkurs 01 · Trainingsstrecke',short:'Testkurs 01',nodes:baseNodes,trainable:true},
  curves:{name:'Testkurs 02 · Wechselkurven',nodes:[[260,630],[130,480],[160,285],[330,165],[540,180],[685,300],[850,175],[1050,260],[1060,470],[900,635],[705,510],[480,635]]},
  oval:{name:'Testkurs 03 · Weite Bögen',nodes:[[280,620],[145,490],[130,300],[270,170],[480,135],[720,135],[940,180],[1070,315],[1050,500],[890,635],[675,670],[455,660]]},
  hairpin:{name:'Testkurs 04 · Enge Kurven',nodes:[[200,640],[125,450],[150,180],[380,150],[410,390],[570,400],[620,170],[1020,160],[1080,450],[920,650],[670,620],[440,610]]},
  reverse:{name:'Testkurs 05 · Gegenrichtung',nodes:[baseNodes[0],...baseNodes.slice(1).reverse()]}
};
const ring=(window.RACING_TRACKS||{}).nuerburgring;
if(ring)courses.nuerburgring={...ring,short:'Nürburgring',trainable:true,caption:'NÜRBURGRING GP-STRECKE · '+(ring.lengthMeters/1000).toFixed(2).replace('.',',')+' KM · MASSSTÄBLICH'};

// Geometrie einer Strecke: Mittellinie, Lauflänge, rechte/linke Begrenzung.
function geometry(id){
  const c=courses[id];let pts=[],halfW;
  if(c.nodes){const nodes=c.nodes,N=nodes.length;
    for(let j=0;j<N;j++)for(let q=0;q<24;q++){let t=q/24,a=nodes[(j+N-1)%N],b=nodes[j],d0=nodes[(j+1)%N],d=nodes[(j+2)%N];pts.push([0,1].map(k=>.5*(2*b[k]+(-a[k]+d0[k])*t+(2*a[k]-5*b[k]+4*d0[k]-d[k])*t*t+(-a[k]+3*b[k]-3*d0[k]+d[k])*t*t*t)));}
    halfW=pts.map(()=>[30,30]);
  }else{pts=c.points.map(p=>p.slice());halfW=c.widths.map(w=>w.slice());}
  const M=pts.length,wrap=i=>(i%M+M)%M,ds=[0],edges=[],rn=[];let total=0;
  for(let i=0;i<M;i++){const p=pts[i],n=pts[wrap(i+1)],prev=pts[wrap(i-1)],dx=n[0]-prev[0],dy=n[1]-prev[1],l=Math.hypot(dx,dy);
    rn.push([-dy/l,dx/l]);// Einheitsvektor nach rechts (Bildschirm-y zeigt nach unten)
    edges.push([[p[0]-dy/l*halfW[i][0],p[1]+dx/l*halfW[i][0]],[p[0]+dy/l*halfW[i][1],p[1]-dx/l*halfW[i][1]]]);
    total+=Math.hypot(n[0]-p[0],n[1]-p[1]);ds.push(total);}
  return {id,pts,M,wrap,ds,total,edges,halfW,rn,uniform:!!c.nodes,view:c.view||{s:1,ox:0,oy:0},
    sensorWindow:c.sensorWindow||34,timeLimit:c.timeLimit||70};
}
const tracks={};for(const id in courses)tracks[id]=geometry(id);
let T=tracks.training,trackId='training';
function nearest(x,y,center,range){let best=null;for(let k=center-range;k<=center+range;k++){let i=T.wrap(k),p=T.pts[i],q=T.pts[T.wrap(i+1)],dx=q[0]-p[0],dy=q[1]-p[1],t=Math.max(0,Math.min(1,((x-p[0])*dx+(y-p[1])*dy)/(dx*dx+dy*dy))),d=Math.hypot(x-p[0]-t*dx,y-p[1]-t*dy);if(!best||d<best.d)best={i,d,s:T.ds[i]+t*Math.hypot(dx,dy),right:dx*(y-p[1])-dy*(x-p[0])>=0};}return best;}
// Deko-Bäume: feste Bildschirmraster-Positionen, abseits der Fahrbahn, in Weltkoordinaten gespeichert.
function plantTrees(){const v=T.view,out=[];for(let i=0;i<55;i++){const sx=(i*193+50)%1200,sy=(i*137+45)%800,x=(sx-v.ox)/v.s,y=(sy-v.oy)/v.s;if(nearest(x,y,0,T.M).d*v.s<53)continue;out.push([x,y,(7+i%5)/v.s]);}return out;}
let trees=[];

// ---------- Netz ----------
const angles=[-1.55,-1.05,-.5,0,.5,1.05,1.55],W=122,rand=()=>Math.random()*2-1;
function fresh(){return Array.from({length:W},()=>rand()*.8)}
// v1-Mutation: 65 % der Gewichte ändern sich (für den Einzelwagen).
function mutate(base){let scale=Math.random()<.12?.7:.12+Math.random()*.2;return base.map(v=>Math.random()<.65?v+rand()*scale:v)}
function predict(inputs,model,act){let z=0,h=[];for(let j=0;j<10;j++){let v=model[z++];for(let i=0;i<9;i++)v+=model[z++]*inputs[i];h.push(Math.tanh(v));}const out=[0,1].map(()=>{let v=model[z++];for(let j=0;j<10;j++)v+=model[z++]*h[j];return Math.tanh(v)});if(act){act.input=inputs.slice();act.hidden=h;act.output=out;}return out;}

// ---------- Genetischer Algorithmus ----------
const GA={elite:4,immigrants:2,tournament:3,geneRate:.15};
// Gene als Bausteine: je ein verstecktes Neuron (Bias + 9) bzw. ein Ausgang (Bias + 10).
const blocks=[...Array.from({length:10},(_,j)=>[j*10,j*10+10]),[100,111],[111,122]];
function crossover(a,b){const child=a.slice();for(const [s,e] of blocks)if(Math.random()<.5)for(let i=s;i<e;i++)child[i]=b[i];return child;}
function mutateGA(base){let scale=Math.random()<.1?.7:.12+Math.random()*.2;return base.map(v=>Math.random()<GA.geneRate?v+rand()*scale:v)}
function tournament(ranked){let best=null;for(let k=0;k<GA.tournament;k++){const c=ranked[Math.floor(Math.random()*ranked.length)];if(!best||c.score>best.score)best=c;}return best;}
const sameWeights=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);

// ---------- Physik ----------
// Haftungsgrenze (Kammscher Kreis): Die Reifen übertragen höchstens µ·g. Kurvenfahrt
// hat Vorrang; was an Haftung übrig bleibt, steht für Gas oder Bremse zur Verfügung.
// Verlangt die Lenkung mehr Seitenführung, rutscht der Wagen nach außen und verliert Tempo.
// Gleitreibung (v2.2, physics 'slide'): Ein rutschender Reifen hält nur SLIDE · µ·g. Wer
// rutscht, verliert Seitenführung und Bremskraft, bis die Gleitreibung wieder reicht.
// physics: 'v1' = ohne Grenze, 'grip' = Haftung ohne Gleitreibung (v2.1), 'slide' = mit (v2.2)
const GRIP=1.5,A_MAX=GRIP*9.81*5,SLIDE=.7;// µ = 1,5 · g in Einheiten/s² (1 m = 5 Einheiten)
let physics='slide';
const pct=x=>Math.round(x*100)+' %',
  physicsLabel=()=>physics==='v1'?'ohne Haftungsgrenze (v1)':'mit Haftung '+String(GRIP).replace('.',',')+' g'+(physics==='slide'?' + Gleitreibung '+pct(SLIDE):' ohne Gleitreibung'),
  physicsJson=()=>physics==='v1'?{model:'v1'}:{model:'kamm',grip:GRIP,slide:physics==='slide'?SLIDE:1};
// Bewertung (Gütekriterium): Standard oder mit Abstandsregel. Die Abstandsregel zieht Punkte ab, solange der
// seitliche Abstand (Strahl links/rechts) unter 2,5 m liegt, gewichtet nach der Unterschreitung.
// Lenkruhe (v2.9): Die Fahrer pendeln um die Ideallinie – regelungstechnisch ein Regler mit zu hoher
// Verstärkung und zu wenig Dämpfung. Eine Regel lässt sich einem Netz nicht einprogrammieren, also
// belohnen wir ruhiges Lenken über die Bewertung: Der Lenkweg Σ|ΔLenkung| kostet 2 Punkte je Einheit.
// Kalibriert an vorhandenen Fahrern (ruhig 32–43, nervös ~60 Einheiten auf Testkurs 01); Begründung
// und Messwerte ausführlich in python/racinglab/reference.py und docs/Validierung.md.
// Abstandsregel und Lenkruhe sind kombinierbar: scoring ∈ standard · abstand · ruhe · abstand+ruhe.
const CLEAR=2.5*5,CLEAR_WEIGHT=100,CALM_WEIGHT=2,SCORINGS=['standard','abstand','ruhe','abstand+ruhe'];let scoring='standard';
const useClear=()=>scoring.includes('abstand'),useCalm=()=>scoring.includes('ruhe'),
  scoringLabel=()=>scoring==='standard'?'Standard':'mit '+[useClear()&&'Abstandsregel 2,5 m',useCalm()&&'Lenkruhe'].filter(Boolean).join(' + '),
  scoringJson=()=>scoring==='standard'?{model:'standard'}:{model:scoring,...(useClear()?{minDistanceM:2.5,weight:CLEAR_WEIGHT}:{}),...(useCalm()?{calmWeight:CALM_WEIGHT}:{})};

// ---------- Zustand ----------
let driverId='training',method='population',popSize=40;
let incumbent=null,bestScore=-Infinity,bestProgress=0,attempt=1,generation=1,history=[],records=[],samples=[],testResults=[];
let cars=[],leader=null,running=false,testMode=false,collision=null,acc=0,last=0,status='Bereit',connections=[];
const keys={driver:id=>'racing-lab-v2-driver-'+id+(physics==='v1'?'':'-'+physics)+(scoring==='standard'?'':'-'+scoring),physics:'racing-lab-v2-physics',scoring:'racing-lab-v2-scoring',course:'racing-lab-v2-course',active:'racing-lab-v2-active-driver',v1:'racing-lab-single-driver-v1'};
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v);return true}catch(e){return false}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const label=id=>courses[id].short||courses[id].name;
// Protokollangaben: Wann, auf welcher Strecke, mit welcher Physik und welchem Lernverfahren?
const nowIso=()=>new Date().toISOString(),day=iso=>{const d=new Date(iso||NaN),p=n=>String(n).padStart(2,'0');return isNaN(d)?'Datum unbekannt':d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());},// Ortszeit
  algoLabel=()=>method==='single'?'Einzelwagen (Hill Climbing)':'Population (genetischer Algorithmus) · '+popSize+' Wagen';
let origin={};// wie der aktuelle beste Fahrer entstanden ist: {date, algorithm}
let bestLaps={};// beste Rundenzeit je Strecke (Sekunden) des aktuellen besten Fahrers; beginnt neu, sobald er ersetzt wird
const noteLap=(id,t)=>{if(Number.isFinite(t)&&!(bestLaps[id]<=t))bestLaps[id]=t;},secs=t=>t.toFixed(2)+' s',
  // Bestzeiten aus Protokollen nachbilden: nur Testfahrten dieses Fahrers (gleiches Trainingsdatum) und seine eigene Trainingsrunde
  lapsFrom=(tests,recs,trainId,trainedAt)=>{const out={};for(const r of tests||[])if(r&&r.completed&&courses[r.trackId]&&Number.isFinite(r.time)&&(!trainedAt||!r.trainedAt||r.trainedAt===trainedAt)&&!(out[r.trackId]<=r.time))out[r.trackId]=r.time;
    for(const r of recs||[])if(r&&r.improved&&r.reason==='Runde geschafft!'&&Number.isFinite(r.time)&&!(out[trainId]<=r.time))out[trainId]=r.time;return out;};

function saveCheckpoint(){
  if(!incumbent)return;
  const ok=store.set(keys.driver(driverId),JSON.stringify({version:2,driverId,origin,bestLaps,attempt,generation,bestScore,bestProgress,incumbent,history:history.slice(-180),records:records.slice(-200),samples:samples.slice(-1000),testResults:testResults.slice(-50)}));
  $('storageStatus').textContent=ok?'✓ Bester Fahrer ('+label(driverId)+') und letzte 200 Versuche automatisch in diesem Browser gespeichert.':'Automatisches Speichern nicht verfügbar. Bitte JSON exportieren.';
}
function clearState(){origin={};bestLaps={};incumbent=null;bestScore=-Infinity;bestProgress=0;attempt=1;generation=1;history=[];records=[];samples=[];testResults=[];}
function restoreCheckpoint(id){
  clearState();
  try{let raw=store.get(keys.driver(id)),fromV1=false;if(!raw&&id==='training'&&physics==='v1'){raw=store.get(keys.v1);fromV1=!!raw;}if(!raw)return false;const data=JSON.parse(raw);
    if(!Array.isArray(data.incumbent)||data.incumbent.length!==W||!data.incumbent.every(Number.isFinite)||!Number.isFinite(data.bestScore)||!Number.isFinite(data.bestProgress)||!Number.isSafeInteger(data.attempt))return false;
    origin=data.origin&&typeof data.origin==='object'?data.origin:{};bestLaps=data.bestLaps&&typeof data.bestLaps==='object'?data.bestLaps:lapsFrom(data.testResults,data.records,id,origin.date);incumbent=data.incumbent.slice();bestScore=data.bestScore;bestProgress=Math.max(0,Math.min(tracks[id].total,data.bestProgress));attempt=data.attempt;generation=Number.isSafeInteger(data.generation)?data.generation:1;
    history=Array.isArray(data.history)?data.history.filter(Number.isFinite).slice(-180):[];records=Array.isArray(data.records)?data.records.slice(-200):[];samples=Array.isArray(data.samples)?data.samples.slice(-1000):[];testResults=Array.isArray(data.testResults)?data.testResults.slice(-50):[];
    $('logCount').textContent=records.length+' gespeicherte Versuche';$('storageStatus').textContent=fromV1?'✓ Fahrer aus Racing Lab v1 übernommen.':'✓ Gespeichertes Training geladen. Der nächste Versuch baut auf dem besten Fahrer auf.';
    return true;
  }catch(e){$('storageStatus').textContent='Gespeicherter Stand konnte nicht gelesen werden. Bitte JSON exportieren.';return false;}
}

// ---------- Fahrzeug ----------
function makeCar(weights,id=0){const p=T.pts[0],n=T.pts[1],a=Math.atan2(n[1]-p[1],n[0]-p[0]);return {id,weights,x:p[0],y:p[1],a,v:0,omega:0,i:0,progress:0,max:0,time:0,stall:0,slip:0,sliding:false,near:0,steerTravel:0,lastSteer:0,gripUse:0,sensors:[],trail:[],skids:[],sampleTick:-1,alive:true,score:null,reason:null,act:{input:Array(9).fill(0),hidden:Array(10).fill(0),output:[0,0]}};}
function startGeneration(models){cars=models.map((w,k)=>makeCar(w,k));leader=cars[0];}
function sense(c){return angles.map(angle=>{const dx=Math.cos(c.a+angle),dy=Math.sin(c.a+angle),win=T.sensorWindow;let dist=180;for(let k=c.i-win;k<c.i+win;k++)for(let side=0;side<2;side++){let p=T.edges[T.wrap(k)][side],q=T.edges[T.wrap(k+1)][side],sx=q[0]-p[0],sy=q[1]-p[1],den=dx*sy-dy*sx;if(Math.abs(den)<1e-8)continue;const px=p[0]-c.x,py=p[1]-c.y,t=(px*sy-py*sx)/den,u=(px*dy-py*dx)/den;if(t>=0&&u>=0&&u<=1)dist=Math.min(dist,t);}return dist;});}
function advance(c){const dt=1/60;c.sensors=sense(c);
  {const d=Math.min(c.sensors[0],c.sensors[6]);if(d<CLEAR)c.near+=(CLEAR-d)/CLEAR*dt;}// Abstandsregel messen (wird nur mit Abstandsregel bewertet)
  const [steer,pedal]=predict([...c.sensors.map(v=>v/180),c.v/160,c.omega/4],c.weights,c.act);
  c.steerTravel+=Math.abs(steer-c.lastSteer);c.lastSteer=steer;// Lenkruhe messen (wird nur mit Lenkruhe bewertet)
  if(physics!=='v1'){
    const limit=physics==='slide'&&c.sliding?A_MAX*SLIDE:A_MAX;// rutscht er schon, hält nur noch die Gleitreibung
    const lat=Math.min(c.v*Math.abs(c.v/22*Math.tan(steer*.52)),limit),avail=Math.sqrt(limit*limit-lat*lat);// Restbudget längs
    const tire=Math.max(-avail,Math.min(avail,pedal*(pedal>0?85:140)));
    c.v=Math.max(0,Math.min(170,c.v+(tire-.13*c.v)*dt));
    const wanted=c.v/22*Math.tan(steer*.52);
    if(c.v>0&&Math.abs(wanted)*c.v>limit){const omegaMax=limit/c.v;c.slip=1-omegaMax/Math.abs(wanted);c.omega=Math.sign(wanted)*omegaMax;c.v=Math.max(0,c.v-c.slip*.5*limit*dt);c.sliding=true;}// Rutschen: Untersteuern + Reibverlust
    else{c.slip=0;c.omega=wanted;c.sliding=false;}
    c.gripUse=Math.hypot(tire,c.v*c.omega)/A_MAX;
    if(c.slip>0){c.skids.push([c.x,c.y]);if(c.skids.length>400)c.skids.shift();}
  }else{c.v=Math.max(0,Math.min(170,c.v+(pedal*(pedal>0?85:140)-.13*c.v)*dt));c.omega=c.v/22*Math.tan(steer*.52);c.slip=0;c.gripUse=Math.hypot(pedal*(pedal>0?85:140),c.v*c.omega)/A_MAX;}
  c.a+=c.omega*dt;c.x+=Math.cos(c.a)*c.v*dt;c.y+=Math.sin(c.a)*c.v*dt;c.time+=dt;
  if(c===leader&&Math.floor(c.time*5)!==c.sampleTick){c.sampleTick=Math.floor(c.time*5);samples.push({attempt,generation,testMode,trackId,driverId:c.id,time:c.time,inputs:c.act.input.slice(),hidden:c.act.hidden.slice(),outputs:c.act.output.slice()});if(samples.length>10000)samples.shift();}
  const previous=c.trail.length?c.trail[c.trail.length-1]:T.pts[0],old=nearest(previous[0],previous[1],c.i,5),n=nearest(c.x,c.y,c.i,7);let delta=n.s-old.s;if(delta<-T.total/2)delta+=T.total;if(delta>T.total/2)delta-=T.total;c.progress+=delta;c.i=n.i;
  if(c.progress>c.max+.05){c.max=c.progress;c.stall=0}else c.stall+=dt;c.trail.push([c.x,c.y]);if(c.trail.length>160)c.trail.shift();
  // Wandkontakt: Mittelpunkt näher als 7 Einheiten (1,4 m) an der jeweiligen Begrenzung.
  if(n.d>T.halfW[n.i][n.right?0:1]-7)return 'Wandkontakt';if(c.progress>=T.total)return 'Runde geschafft!';if(c.stall>3)return 'Kein Fortschritt';if(c.time>T.timeLimit)return 'Zeitlimit';return null;}
// Fortschritt auf eine Runde begrenzt: Sonst zählt der Überschuss hinter der Ziellinie
// mit, und eine langsamere Runde kann besser bewertet werden als eine schnellere.
// Abzüge in derselben Reihenfolge wie python score(), damit die Punktzahlen bitgenau gleich sind
const scoreOf=c=>{let s=Math.min(c.progress,T.total)-c.time*.6+(c.progress>=T.total?500:0);if(useClear())s-=CLEAR_WEIGHT*c.near;if(useCalm())s-=CALM_WEIGHT*c.steerTravel;return s;};

function endCar(c,reason){
  c.alive=false;c.reason=reason;c.score=scoreOf(c);
  if(reason==='Wandkontakt'&&c===leader)collision={x:c.x,y:c.y,until:Date.now()+850};
  if(testMode)return;
  const improved=c.score>bestScore;c.improved=improved;
  records.push({at:nowIso(),algorithm:algoLabel(),attempt,generation,car:c.id,score:c.score,reason,improved,time:c.time,progress:c.progress,weights:c.weights.slice(),deltaFromBest:incumbent?c.weights.map((w,i)=>w-incumbent[i]):null});if(records.length>5000)records.shift();
  $('logCount').textContent=records.length+' protokollierte Versuche';
  if(improved){bestLaps={};if(reason==='Runde geschafft!')noteLap(trackId,c.time);bestScore=c.score;incumbent=c.weights.slice();origin={date:nowIso(),algorithm:algoLabel()};bestProgress=Math.max(bestProgress,c.max);status='Verbesserung gespeichert · '+reason;}
  attempt++;
}
// Neue Generation aus der alten: Bester bisher + Elite + Zuwanderer + Kinder.
function evolve(){
  history.push(bestScore);if(history.length>180)history.shift();generation++;saveCheckpoint();
  if(method==='single'){const r=cars[0].reason;status=(cars[0].improved?'Verbesserung gespeichert · ':'Neuer Versuch · ')+r;startGeneration([Math.random()<.05?fresh():mutate(incumbent)]);$('status').textContent=status;return;}
  const ranked=cars.slice().sort((a,b)=>b.score-a.score),next=[incumbent.slice()];
  for(const c of ranked){if(next.length>=Math.min(GA.elite,popSize))break;if(!next.some(w=>sameWeights(w,c.weights)))next.push(c.weights.slice());}
  for(let k=0;k<GA.immigrants&&next.length<popSize;k++)next.push(fresh());
  while(next.length<popSize){const a=tournament(ranked),b=tournament(ranked);next.push(mutateGA(crossover(a.weights,b.weights)));}
  const lap=ranked.filter(c=>c.reason==='Runde geschafft!').length;
  status='Generation '+(generation-1)+' fertig · bester '+(ranked[0].max/T.total*100).toFixed(1)+' %'+(lap?' · '+lap+' Runde(n) geschafft':'');
  $('status').textContent=status;startGeneration(next);
}
function trainingModels(){if(!incumbent)return Array.from({length:method==='single'?1:popSize},fresh);if(method==='single')return [mutate(incumbent)];const out=[incumbent.slice()];while(out.length<popSize)out.push(mutateGA(incumbent));return out;}
function step(){
  for(const c of cars)if(c.alive){const r=advance(c);if(r)endCar(c,r);}
  let lead=null;for(const c of cars)if(c.alive&&(!lead||c.progress>lead.progress))lead=c;if(lead)leader=lead;
  if(!lead){if(testMode){running=false;recordTest(cars[0]);}else evolve();}
}

// ---------- Tests auf anderen Strecken ----------
function recordTest(c){if(c.reason==='Runde geschafft!')noteLap(trackId,c.time);const result={date:nowIso(),physics:physicsLabel(),scoring:scoringLabel(),algorithm:origin.algorithm||'Lernverfahren unbekannt',trainedOn:courses[driverId].name,trainedAt:origin.date||null,trackId,course:courses[trackId].name,driver:'Fahrer '+label(driverId)+(physics==='grip'?' · Haftung':physics==='slide'?' · Gleitreibung':''),progressPercent:Math.max(0,Math.min(100,c.max/T.total*100)),time:c.time,completed:c.reason==='Runde geschafft!',reason:c.reason,weightsUnchanged:true};testResults.push(result);if(testResults.length>50)testResults.shift();showTestResults();saveCheckpoint();status='Test beendet · '+c.reason;$('status').textContent=status;return result;}
function showTestResults(){const valid=testResults.filter(r=>r&&courses[r.trackId]&&typeof r.driver==='string'&&Number.isFinite(r.progressPercent)&&Number.isFinite(r.time));$('transferResults').textContent=valid.slice(-10).map(r=>[r.date&&day(r.date),r.course,r.driver,r.physics,r.algorithm,r.scoring&&r.scoring!=='Standard'&&r.scoring,r.progressPercent.toFixed(1)+' %',r.time.toFixed(2)+' s',r.reason].filter(Boolean).join(' | ')).join('\n')||'Noch keine Testfahrt abgeschlossen.';}
function beginTest(){if(!incumbent){$('status').textContent='Zuerst einen Fahrer trainieren oder einen JSON-Stand laden.';return;}
  running=true;testMode=true;collision=null;acc=0;startGeneration([incumbent.slice()]);$('status').textContent='Unverändertes bestes Netz ('+label(driverId)+') auf '+courses[trackId].name+' · kein Lernen während des Tests.';}

// ---------- Strecke, Fahrer, Verfahren wechseln ----------
function updateNotice(){const trainable=trackId===driverId;$('toggle').disabled=!trainable;
  $('courseNotice').textContent=trainable?'Training und unveränderte Testfahrten mit dem Fahrer „'+label(driverId)+'“ verfügbar.':'Prüfstrecke für den Fahrer „'+label(driverId)+'“: Er fährt ohne weiteres Lernen.'+(courses[trackId].trainable?' Zum Lernen auf dieser Strecke oben den Fahrer „'+label(trackId)+'“ wählen.':'');
  $('popSize').disabled=method==='single';$('attemptLabel').textContent=method==='single'?'VERSUCH':'GENERATION';$('focusLabel').textContent=method==='single'?'LIVE · KAMERA AM WAGEN':'LIVE · KAMERA AM FÜHRENDEN WAGEN';}
function idleCars(){startGeneration(incumbent?[incumbent.slice()]:[fresh()]);}
function switchCourse(id){if(!courses[id])return;running=false;testMode=false;collision=null;acc=0;trackId=id;T=tracks[id];trees=plantTrees();$('courseSelect').value=id;
  $('courseCaption').textContent=courses[id].caption||courses[id].name.toUpperCase()+' · VOGELPERSPEKTIVE';idleCars();updateNotice();store.set(keys.course,id);
  $('status').textContent='Strecke gewechselt · „Besten Fahrer testen“ startet die Prüfung mit unveränderten Gewichten.';}
function switchDriver(id){if(!courses[id]||!courses[id].trainable)return;saveCheckpoint();running=false;testMode=false;driverId=id;$('driver').value=id;store.set(keys.active,id);
  if(!restoreCheckpoint(id)){$('logCount').textContent='0 protokollierte Versuche';$('storageStatus').textContent='Fahrer „'+label(id)+'“ ist noch untrainiert.';}
  showTestResults();idleCars();updateNotice();$('status').textContent='Fahrer „'+label(id)+'“ aktiv.';}
function switchScoring(m){m=SCORINGS.includes(m)?m:'standard';saveCheckpoint();running=false;testMode=false;scoring=m;$('scoring').value=m;store.set(keys.scoring,m);
  if(!restoreCheckpoint(driverId)){$('logCount').textContent='0 protokollierte Versuche';$('storageStatus').textContent='Fahrer „'+label(driverId)+'“ ist mit Bewertung „'+scoringLabel()+'“ noch untrainiert.';}
  showTestResults();idleCars();updateNotice();$('status').textContent='Bewertung: '+scoringLabel()+'. Jede Bewertung hat eigene Fahrerstände.';}
function switchPhysics(p){p=['v1','grip'].includes(p)?p:'slide';saveCheckpoint();running=false;testMode=false;physics=p;$('physics').value=p;store.set(keys.physics,p);
  if(!restoreCheckpoint(driverId)){$('logCount').textContent='0 protokollierte Versuche';$('storageStatus').textContent='Fahrer „'+label(driverId)+'“ ist '+physicsLabel()+' noch untrainiert.';}
  showTestResults();idleCars();updateNotice();$('status').textContent='Physik: '+physicsLabel()+'. Jede Physik hat eigene Fahrerstände.';}
function setMethod(m){method=m==='single'?'single':'population';$('method').value=method;updateNotice();}

// ---------- Zeichnen ----------
function centerPath(g){g.beginPath();T.pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();}
// Fläche zwischen rechter und linker Begrenzung, um "extra" Einheiten verbreitert.
function bandPath(g,extra){g.beginPath();for(const side of [1,-1]){T.pts.forEach((p,i)=>{const w=(side>0?T.halfW[i][0]:T.halfW[i][1])+extra,x=p[0]+side*T.rn[i][0]*w,y=p[1]+side*T.rn[i][1]*w;i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();}}
function edgePath(g,side,extra){g.beginPath();T.pts.forEach((p,i)=>{const w=(side>0?T.halfW[i][0]:T.halfW[i][1])+extra,x=p[0]+side*T.rn[i][0]*w,y=p[1]+side*T.rn[i][1]*w;i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();}
function paintCar(g,c,color,k){g.save();g.translate(c.x,c.y);g.rotate(c.a);g.scale(k,k);g.fillStyle='#15282c';for(const x of [-8,8])for(const y of [-5.5,5.5])g.fillRect(x-3,y-2,6,4);g.strokeStyle='#182b31';g.lineWidth=1.2;g.fillStyle=color;g.beginPath();g.moveTo(14,-1.8);g.lineTo(3,-3.6);g.lineTo(-6,-4);g.lineTo(-11,-3);g.lineTo(-11,3);g.lineTo(-6,4);g.lineTo(3,3.6);g.lineTo(14,1.8);g.closePath();g.fill();g.stroke();g.fillStyle='#ffcc68';g.fillRect(10,-5,3,10);g.fillStyle='#172e37';g.fillRect(-13,-5,3,10);g.fillStyle='#f8e8bd';g.beginPath();g.ellipse(-1,0,3,2.2,0,0,7);g.fill();g.restore();}
// Zeichnet die Welt mit Maßstab s und Versatz (ox, oy) – für Übersicht und Wagenkamera.
function drawScene(g,s,ox,oy,w,h){
  const px=1/s,k=Math.max(1,.45/s);
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);g.fillStyle='#bbce9c';g.fillRect(0,0,w,h);g.setTransform(s,0,0,s,ox,oy);
  for(const [x,y,r] of trees){g.fillStyle='#8eaf76';g.beginPath();g.arc(x,y,r,0,7);g.fill();g.strokeStyle='#6f9363';g.lineWidth=2*px;g.stroke();}
  g.lineJoin='round';
  if(T.uniform){centerPath(g);g.strokeStyle='#243a3e';g.lineWidth=76;g.stroke();centerPath(g);g.strokeStyle='#fff5dc';g.lineWidth=70;g.stroke();centerPath(g);g.strokeStyle='#eb7658';g.lineWidth=70;g.setLineDash([12,12]);g.stroke();g.setLineDash([]);centerPath(g);g.strokeStyle='#4a5c60';g.lineWidth=60;g.stroke();}
  else{const kerb=Math.max(5,1.6*px);bandPath(g,kerb+Math.max(3,1.2*px));g.fillStyle='#243a3e';g.fill('evenodd');bandPath(g,kerb);g.fillStyle='#fff5dc';g.fill('evenodd');
    g.strokeStyle='#eb7658';g.lineWidth=kerb;g.setLineDash([12,12]);for(const side of [1,-1]){edgePath(g,side,kerb/2);g.stroke();}g.setLineDash([]);bandPath(g,0);g.fillStyle='#4a5c60';g.fill('evenodd');}
  centerPath(g);g.strokeStyle='#87908a';g.lineWidth=px;g.setLineDash([12,14]);g.stroke();g.setLineDash([]);
  const p=T.pts[0],n=T.pts[1],wr=T.halfW[0][0],wl=T.halfW[0][1],sq=(wr+wl)/8;g.save();g.translate(...p);g.rotate(Math.atan2(n[1]-p[1],n[0]-p[0]));g.scale(Math.max(1,2*px/5),1);for(let i=0;i<8;i++)for(let j=0;j<2;j++){g.fillStyle=(i+j)%2?'#fff9e8':'#26373a';g.fillRect(-5+j*5,-wl+i*sq,5,sq)}g.restore();
  const lead=leader;if(lead&&lead.skids.length){g.fillStyle='#2a2a2a55';for(const [x,y] of lead.skids)g.fillRect(x-1.5,y-1.5,3,3);}// Rutschspuren
  if(lead&&lead.trail.length){g.beginPath();lead.trail.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.strokeStyle='#f6b66680';g.lineWidth=2*px;g.stroke();}
  if(lead&&$('rays').checked){g.strokeStyle='#d7ed9bb0';g.lineWidth=1.5*px;lead.sensors.forEach((d,i)=>{g.beginPath();g.moveTo(lead.x,lead.y);g.lineTo(lead.x+Math.cos(lead.a+angles[i])*d,lead.y+Math.sin(lead.a+angles[i])*d);g.stroke();});}
  g.globalAlpha=.4;for(const c of cars)if(c.alive&&c!==lead)paintCar(g,c,'#f3a27f',k);g.globalAlpha=1;
  if(lead)paintCar(g,lead,'#fa7644',k);
  g.setTransform(1,0,0,1,0,0);
}
function draw(){
  const v=T.view,lead=leader||cars[0];drawScene(ctx,v.s,v.ox,v.oy,1200,800);
  // Das Fahrzeug liegt zusätzlich auf einer SVG-Ebene, damit es immer sichtbar bleibt.
  const sx=lead.x*v.s+v.ox,sy=lead.y*v.s+v.oy,z=Math.min(1,v.s*Math.max(1,.45/v.s));
  $('vehicle-position').setAttribute('transform',`translate(${sx} ${sy})`);
  $('vehicle-heading').setAttribute('transform',`rotate(${lead.a*180/Math.PI}) scale(${z})`);
  const marker=$('collision-marker');marker.setAttribute('visibility',collision&&Date.now()<collision.until?'visible':'hidden');if(collision)marker.setAttribute('transform',`translate(${collision.x*v.s+v.ox} ${collision.y*v.s+v.oy})`);
  // Wagenkamera: eigene Darstellung der Welt, zentriert auf den führenden Wagen.
  const fs=1.6;drawScene(fx,fs,160-lead.x*fs,80-lead.y*fs,320,160);
  const [steer,pedal]=lead.act.output,alive=cars.filter(c=>c.alive).length;
  {const d=Math.min(lead.sensors[0]??180,lead.sensors[6]??180)*.2;$('clearInfo').textContent=[useClear()&&'Seitenabstand '+d.toFixed(1)+' m'+(d<2.5?' · zu nah, kostet Punkte':''),useCalm()&&'Lenkweg bisher '+lead.steerTravel.toFixed(1)].filter(Boolean).join(' · ');$('clearInfo').style.color=useClear()&&d<2.5?'#c4302b':'';}
  $('gripUse').textContent=lead.gripUse.toFixed(2)+(lead.slip>0?' · rutscht!':physics==='v1'&&lead.gripUse>1?' · (ohne Grenze)':'');$('gripbar').style.width=Math.min(100,lead.gripUse*100)+'%';$('gripbar').style.background=lead.slip>0||lead.gripUse>1?'#c4302b':'#f47342';
  $('attempt').textContent=method==='single'?attempt:generation;$('speed').textContent=Math.round(lead.v*.2*3.6)+' km/h';$('lapTime').textContent=secs(lead.time);$('bestLap').textContent=bestLaps[trackId]?secs(bestLaps[trackId]):'–';$('progress').textContent=Math.max(0,Math.min(100,lead.progress/T.total*100)).toFixed(1)+' %';$('best').textContent=Math.min(100,bestProgress/tracks[driverId].total*100).toFixed(1)+' %';// Überschuss hinter der Ziellinie nicht als >100 % anzeigen
  $('steer').textContent=steer.toFixed(2);$('pedal').textContent=pedal.toFixed(2);$('steerbar').style.width=(steer+1)*50+'%';$('pedalbar').style.width=(pedal+1)*50+'%';
  $('popInfo').textContent=testMode?'Testfahrt · ein Wagen mit eingefrorenen Gewichten':method==='single'?'Einzelwagen · Hill Climbing wie v1':alive+' von '+cars.length+' Wagen unterwegs · Generation '+generation+' · '+attempt+' Fahrten gesamt';
  $('badge').textContent=running?(testMode?'● TESTFAHRT':'● TRAINING LÄUFT'):'● PAUSIERT';$('toggle').textContent=running&&!testMode?'Pause ❚❚':'Training starten ↗';
  hx.clearRect(0,0,440,120);if(history.length>1){const lo=Math.min(0,...history),hi=Math.max(10,...history);hx.beginPath();history.forEach((v,i)=>{let x=i/(history.length-1)*430+5,y=112-(v-lo)/(hi-lo)*102;i?hx.lineTo(x,y):hx.moveTo(x,y)});hx.strokeStyle='#ee7543';hx.lineWidth=3;hx.stroke();}
}

// ---------- Netzansicht ----------
const nc=$('network'),nx=nc.getContext('2d');nc.width=1100;nc.height=400;
function network(){const lead=leader||cars[0],weights=lead.weights,activations=lead.act;nx.clearRect(0,0,1100,400);connections=[];const ys=(n,i)=>45+i*310/(n-1),xs=[210,570,920],layers=[activations.input,activations.hidden,activations.output],labels=['Abstand links','Schräg links','Vorne links','Vorne','Vorne rechts','Schräg rechts','Abstand rechts','Tempo','Drehrate'];let z=0;
  function edge(a,b,w,label){nx.beginPath();nx.moveTo(...a);nx.lineTo(...b);nx.strokeStyle=w>=0?'rgba(235,104,57,.38)':'rgba(40,117,169,.38)';nx.lineWidth=.4+Math.min(3,Math.abs(w));nx.stroke();connections.push({a,b,w,label});}
  for(let j=0;j<10;j++){z++;for(let i=0;i<9;i++)edge([xs[0],ys(9,i)],[xs[1],ys(10,j)],weights[z++],labels[i]+' → H'+(j+1));}for(let j=0;j<2;j++){z++;for(let i=0;i<10;i++)edge([xs[1],ys(10,i)],[xs[2],ys(2,j)],weights[z++],'H'+(i+1)+' → '+(j?'Fahrpedal':'Lenkung'));}
  layers.forEach((layer,l)=>layer.forEach((v,i)=>{let x=xs[l],y=ys(layer.length,i);nx.beginPath();nx.arc(x,y,12,0,7);nx.fillStyle=v>=0?`rgba(244,115,65,${.15+.85*Math.min(1,Math.abs(v))})`:`rgba(40,117,169,${.15+.85*Math.min(1,Math.abs(v))})`;nx.fill();nx.strokeStyle='#20383c';nx.lineWidth=1.5;nx.stroke();nx.fillStyle='#20383c';nx.font='12px monospace';nx.textAlign=l===0?'right':'left';nx.fillText((l===0?labels[i]:l===1?'H'+(i+1):i?'Fahrpedal':'Lenkung')+' '+v.toFixed(2),x+(l===0?-20:20),y+4);}));nx.font='12px monospace';nx.textAlign='center';['9 EINGÄNGE','10 VERSTECKTE KNOTEN','2 AUSGÄNGE'].forEach((t,i)=>nx.fillText(t,xs[i],20));}
nc.onclick=e=>{const r=nc.getBoundingClientRect(),x=(e.clientX-r.left)*1100/r.width,y=(e.clientY-r.top)*400/r.height;let best=null;for(const c of connections){const dx=c.b[0]-c.a[0],dy=c.b[1]-c.a[1],t=Math.max(0,Math.min(1,((x-c.a[0])*dx+(y-c.a[1])*dy)/(dx*dx+dy*dy))),d=Math.hypot(x-c.a[0]-t*dx,y-c.a[1]-t*dy);if(!best||d<best.d)best={...c,d};}if(best&&best.d<18)$('weightDetail').textContent=best.label+' | Gewicht: '+best.w.toFixed(6)+' | Generation '+generation;};

// ---------- Export / Import ----------
function download(name,data,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
$('exportLog').onclick=()=>download('racing-'+driverId+'-'+physics+(scoring==='standard'?'':'-'+scoring)+'-'+nowIso().slice(0,10)+'.json',JSON.stringify({formatVersion:1,app:'racing-lab-v2',bestLaps,meta:{exportedAt:nowIso(),trainingTrack:courses[driverId].name,physics:physicsLabel(),algorithm:origin.algorithm||algoLabel(),scoring:scoringLabel(),trainedAt:origin.date||null},scoring:scoringJson(),algorithm:method==='single'?'sequential random mutation with elitist selection':'genetic algorithm: elitism, tournament selection, neuron-block crossover, mutation',population:method==='single'?1:popSize,generation,physics:physicsJson(),architecture:[9,10,2],weightLayout:'hidden: bias then 9 inputs per neuron; output: bias then 10 hidden per neuron',reward:'min(progress, lap) - 0.6*time + 500 for completed lap'+(useClear()?' - 100*near-wall time (lateral rays < 2.5 m)':'')+(useCalm()?' - 2*steering travel sum(|delta steer|)':''),sensorRange:180,track:T.pts,trackId,courseProfiles:Object.entries(courses).map(([id,c])=>({id,name:c.name,nodes:c.nodes||null})),trainingTrackId:driverId,bestProgress,trainingLength:tracks[driverId].total,testResults,bestScore:Number.isFinite(bestScore)?bestScore:null,bestWeights:incumbent,currentWeights:(leader||cars[0]).weights,records:records.slice(-2000),samples},null,2),'application/json');
$('exportCsv').onclick=()=>download('racing-versuche-'+driverId+'-'+physics+'-'+nowIso().slice(0,10)+'.csv','date;trainingTrack;physics;algorithm;attempt;generation;car;score;time;progress;improved;reason\n'+records.map(r=>[r.at||'',courses[driverId].name,physicsLabel(),r.algorithm||'',r.attempt,r.generation??'',r.car??0,r.score,r.time,r.progress,r.improved,r.reason].join(';')).join('\n'),'text/csv');
$('importLog').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const data=JSON.parse(await file.text());
    if(data.formatVersion!==1||JSON.stringify(data.architecture)!=='[9,10,2]'||!Array.isArray(data.bestWeights)||data.bestWeights.length!==W||!data.bestWeights.every(Number.isFinite)||!Number.isFinite(data.bestScore))throw Error('Datei enthält keinen gültigen trainierten Fahrer.');
    const dp=data.physics||{model:'v1'},slide=dp.slide??1,phys=dp.model!=='kamm'?'v1':slide===1?'grip':slide===SLIDE?'slide':null;
    if(dp.model==='kamm'&&(dp.grip!==GRIP||!phys))throw Error('Fahrer wurde mit Haftung '+dp.grip+' g und Gleitreibung '+pct(slide)+' trainiert; diese Seite kennt '+GRIP+' g mit 100 % oder '+pct(SLIDE)+'.');if(phys!==physics)switchPhysics(phys);
    // Bewertung des Fahrers übernehmen; abweichende Parameter würden andere Punktzahlen ergeben
    const ds=data.scoring||{model:'standard'};if(!SCORINGS.includes(ds.model))throw Error('Unbekannte Bewertung: '+ds.model);
    if(ds.model.includes('abstand')&&(ds.minDistanceM!==2.5||ds.weight!==CLEAR_WEIGHT))throw Error('Fahrer wurde mit einer anderen Abstandsregel trainiert.');
    if(ds.model.includes('ruhe')&&ds.calmWeight!==CALM_WEIGHT)throw Error('Fahrer wurde mit einer anderen Lenkruhe-Gewichtung trainiert.');
    if(ds.model!==scoring)switchScoring(ds.model);
    const target=courses[data.trainingTrackId]&&courses[data.trainingTrackId].trainable?data.trainingTrackId:'training';
    switchDriver(target);switchCourse(target);
    setMethod(data.population===1||/^sequential/.test(data.algorithm||'')?'single':'population');// weiter mit dem Verfahren, mit dem er trainiert wurde
    origin=data.meta&&typeof data.meta==='object'?{date:data.meta.trainedAt||null,algorithm:data.meta.algorithm||null}:{date:null,algorithm:/genetic/.test(data.algorithm||'')?'Population (genetischer Algorithmus)':'Einzelwagen (Hill Climbing)'};
    incumbent=data.bestWeights.slice();bestScore=data.bestScore;records=Array.isArray(data.records)?data.records.filter(r=>r&&Number.isSafeInteger(r.attempt)&&Number.isFinite(r.score)&&Number.isFinite(r.progress)&&Number.isFinite(r.time)).slice(-200):[];samples=Array.isArray(data.samples)?data.samples.slice(-1000):[];testResults=Array.isArray(data.testResults)?data.testResults.slice(-50):[];showTestResults();
    bestLaps=data.bestLaps&&typeof data.bestLaps==='object'?{...data.bestLaps}:lapsFrom(data.testResults,data.records,target,origin.date);
    bestProgress=Number.isFinite(data.bestProgress)?Math.max(0,Math.min(T.total,data.bestProgress)):Math.max(0,...records.filter(r=>r.improved).map(r=>Math.min(T.total,r.progress)));
    attempt=records.length?Math.max(...records.map(r=>r.attempt))+1:2;generation=Number.isSafeInteger(data.generation)?data.generation:1;collision=null;
    // Verlauf „Bester Score“ aus den mitgelieferten Versuchen nachbilden (laufendes Maximum)
    history=[];let run=-Infinity;for(const r of records){run=Math.max(run,r.score);history.push(run);}history=history.slice(-180);idleCars();saveCheckpoint();
    $('logCount').textContent=records.length+' importierte Versuche';$('status').textContent='Fahrer „'+label(target)+'“ aus JSON geladen · Training fortsetzen oder testen.';
  }catch(err){$('status').textContent='Import fehlgeschlagen: '+err.message;}
  e.target.value='';
};

// ---------- Bedienung ----------
$('courseSelect').onchange=e=>switchCourse(e.target.value);
$('physics').onchange=e=>switchPhysics(e.target.value);
$('scoring').onchange=e=>switchScoring(e.target.value);
$('driver').onchange=e=>switchDriver(e.target.value);
$('method').onchange=e=>{setMethod(e.target.value);if(running&&!testMode){running=false;$('status').textContent='Lernverfahren geändert · Training neu starten.';}};
$('popSize').onchange=e=>{popSize=Number(e.target.value)||40;};
$('toggle').onclick=()=>{if(trackId!==driverId){$('status').textContent='Für Training Strecke und Fahrer gleich wählen.';return;}
  if(running&&!testMode){running=false;return;}testMode=false;collision=null;startGeneration(trainingModels());running=true;$('status').textContent=method==='single'?'Einzelwagen lernt…':'Generation '+generation+' mit '+cars.length+' Wagen startet…';};
$('bestRun').onclick=()=>beginTest();
$('reset').onclick=()=>{running=false;testMode=false;collision=null;clearState();showTestResults();store.del(keys.driver(driverId));if(driverId==='training')store.del(keys.v1);$('logCount').textContent='0 protokollierte Versuche';$('storageStatus').textContent='Neues Training für „'+label(driverId)+'“: gespeicherter Stand gelöscht.';switchCourse(driverId);$('status').textContent='Neues zufälliges Netz. Bereit für die erste Generation.';};

// ---------- Start ----------
if(!courses.nuerburgring){const o=[...$('courseSelect').options].find(o=>o.value==='nuerburgring');if(o)o.remove();const d=[...$('driver').options].find(o=>o.value==='nuerburgring');if(d)d.remove();}
{const savedScoring=store.get(keys.scoring);scoring=SCORINGS.includes(savedScoring)?savedScoring:'standard';$('scoring').value=scoring;const savedPhysics=store.get(keys.physics);physics=['v1','grip'].includes(savedPhysics)?savedPhysics:'slide';$('physics').value=physics;const savedDriver=store.get(keys.active);driverId=savedDriver&&courses[savedDriver]&&courses[savedDriver].trainable?savedDriver:'training';$('driver').value=driverId;restoreCheckpoint(driverId);showTestResults();
  const savedCourse=store.get(keys.course);switchCourse(savedCourse&&courses[savedCourse]?savedCourse:driverId);if(incumbent)$('status').textContent='Bester Fahrer „'+label(driverId)+'“ geladen · Training kann weitergehen.';}
function frame(t){if(last&&running){acc+=Math.min((t-last)/1000,.1)*Number($('rate').value);const t0=Date.now();let count=0;while(acc>=1/60&&count++<2000&&running){step();acc-=1/60;if(Date.now()-t0>14){acc=0;break;}}}else acc=0;last=t;draw();network();requestAnimationFrame(frame)}requestAnimationFrame(frame);
// Deterministisches Schrittweise-Ausführen für lokale Prüfungen; keine externen Dienste.
window.racingLab={step,reset:()=>{$('reset').onclick()},switchCourse,switchDriver,switchPhysics,switchScoring,setMethod,setPopulation:n=>{popSize=n;},beginTest,courseProfiles:()=>JSON.parse(JSON.stringify(courses)),
  stats:()=>({scoring,bestLaps:{...bestLaps},trackId,driverId,method,physics,running,testMode,incumbent:incumbent?.slice(),testResults:testResults.slice(),attempt,generation,bestScore,bestProgress,total:T.total,history:history.slice(),cars:cars.length,alive:cars.filter(c=>c.alive).length,car:{...(leader||cars[0])},weights:(leader||cars[0]).weights.slice()})};
})();
