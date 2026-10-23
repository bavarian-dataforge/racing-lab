// Erzeugt die README-Bilder: öffnet die Simulation in Chrome (headless), stellt Szenen her
// und speichert Ausschnitte als PNG. Nur Node-Bordmittel, keine Pakete.
//
//   node tools/screenshots.mjs            (im Ordner racing-lab-v2)
//
// Ergebnis: ../docs/bilder/*.png
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, '..', 'docs', 'bilder');
fs.mkdirSync(out, {recursive: true});
const chromePath = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9333, profile = fs.mkdtempSync(path.join(os.tmpdir(), 'racing-shots-'));
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--no-first-run', '--window-size=1440,3200'], {stdio: 'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 50; i++) {
    try { return await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method: 'PUT'})).json(); }
    catch { await sleep(200); }
  }
  throw Error('Chrome nicht erreichbar');
}
const target = await connect();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, m => m.error ? rej(Error(method + ': ' + m.error.message)) : res(m.result)); ws.send(JSON.stringify({id: i, method, params})); });
const js = async code => { const r = await send('Runtime.evaluate', {expression: code, awaitPromise: true, returnByValue: true}); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

// Fenster hoch genug für die ganze Seite: Aufnahmen außerhalb des Fensters würden neu umbrechen.
await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 3200, deviceScaleFactor: 1.25, mobile: false});
await send('Page.enable');
await send('Page.navigate', {url: pathToFileURL(path.join(root, 'index.html')).href});
await sleep(1500);

const driver = f => JSON.stringify(fs.readFileSync(path.join(root, f), 'utf8'));
const load = f => js(`(async()=>{await document.getElementById('importFile').onchange({target:{files:[{text:async()=>${driver(f)}}],value:''}});return racingLab.stats().driverId})()`);
const frames = () => js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
// Ausschnitt eines Elements (oder Bereich über mehrere Elemente) als PNG speichern
async function shot(name, selectors, pad = 16) {
  const box = await js(`(()=>{const rs=${JSON.stringify(selectors)}.map(s=>document.querySelector(s).getBoundingClientRect());
    const x=Math.min(...rs.map(r=>r.left)),y=Math.min(...rs.map(r=>r.top))+scrollY,r=Math.max(...rs.map(r=>r.right)),b=Math.max(...rs.map(r=>r.bottom))+scrollY;return {x,y,w:r-x,h:b-y}})()`);
  const {data} = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false,
    clip: {x: box.x - pad, y: box.y - pad, width: box.w + 2 * pad, height: box.h + 2 * pad, scale: 1}});
  fs.writeFileSync(path.join(out, name), Buffer.from(data, 'base64'));
  console.log('✓', name, Math.round(box.w + 2 * pad) + '×' + Math.round(box.h + 2 * pad), 'CSS-Pixel');
}

// 1) Population lernt auf Testkurs 01 (v1-Physik, von Null): mitten in Generation 5
await js(`racingLab.switchPhysics('v1');racingLab.switchDriver('training');racingLab.reset();racingLab.setMethod('population');racingLab.switchCourse('training');document.getElementById('rate').value='1';document.getElementById('toggle').click();
  for(let n=0;n<40000&&racingLab.stats().generation<5;n++)racingLab.step();for(let n=0;n<330;n++)racingLab.step();racingLab.stats().generation`);// läuft bei 1× weiter
await frames();
await shot('01-population-training.png', ['header', '.intro', '.layout', '#courseNotice'], 0);

// 2) Nürburgring: in Python trainierter Fahrer, Testfahrt nach ~95 s
console.log('Fahrer:', await load('fahrer/fahrer-nuerburgring-seed1.json'));
await js(`racingLab.switchCourse('nuerburgring');racingLab.beginTest();for(let n=0;n<95*60;n++)racingLab.step();'ok'`);
await js(`document.getElementById('rate').value='1'`); await frames();
await js(`(()=>{const s=racingLab.stats();return s.running})()`);
await shot('02-nuerburgring.png', ['.layout']);

// 3) Das Netz live während derselben Fahrt
await shot('03-netz-live.png', ['#network'], 2);

// 4) Prüfprotokoll: Flos v1-Fahrer auf allen sechs Strecken
const flo = path.join(root, '..', 'racing-training.json');
if (fs.existsSync(flo)) {
  await js(`(async()=>{await document.getElementById('importFile').onchange({target:{files:[{text:async()=>${JSON.stringify(JSON.stringify({...JSON.parse(fs.readFileSync(flo, 'utf8')), testResults: []}))}}],value:''}});
    for(const id of ['training','curves','oval','hairpin','reverse','nuerburgring']){racingLab.switchCourse(id);racingLab.beginTest();for(let n=0;n<60000&&racingLab.stats().running;n++)racingLab.step();}return 'ok'})()`);
  await frames();
  await shot('04-pruefprotokoll.png', ['#transferResults'], 6);
}
ws.close(); chrome.kill();
await new Promise(r => chrome.on('exit', r));
fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5});
