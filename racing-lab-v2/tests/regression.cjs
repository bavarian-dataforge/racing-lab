'use strict';
// Node's standard library only. No browser, network or packages.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const sources = ['tracks/nuerburgring.js', 'sim.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8'));
const same = (a,b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const saved = new Map();
let exported;
const storage = {
  getItem: k => saved.get(k) ?? null,
  setItem: (k, v) => saved.set(k, v),
  removeItem: k => saved.delete(k),
};
function boot() {
  let nextFrame;
  const elements = {};
  const numericMethods = new Set(['translate','rotate','scale','moveTo','lineTo','arc','ellipse','fillRect','clearRect','setTransform']);
  const context = new Proxy({}, {
    get: (obj, method) => obj[method] || ((...args) => {
      if (numericMethods.has(method)) assert(args.every(Number.isFinite), 'Invalid render value: ' + method);
    }),
    set: (obj, field, value) => (obj[field] = value, true),
  });
  const defaults = {rate: '1', popSize: '40', method: 'population', driver: 'training', physics: 'slide', scoring: 'standard'};
  const el = id => elements[id] ??= {
    getContext: () => context, checked: true, style: {}, options: [],
    value: defaults[id] ?? 'training', textContent: '', attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    getBoundingClientRect: () => ({left:0, top:0, width:1100, height:400}),
  };
  let seed = 1234;
  const math = Object.create(Math);
  math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const runtime = {
    document: {getElementById: el, createElement: () => ({click() {}})},
    localStorage: storage, Math: math, Blob,
    URL: {createObjectURL: b => (exported = b, 'blob:test'), revokeObjectURL() {}},
    requestAnimationFrame: f => { nextFrame = f; }, setTimeout() {},
  };
  runtime.window = runtime;
  vm.createContext(runtime);
  for (const src of sources) vm.runInContext(src, runtime);
  return {lab: runtime.racingLab, el, render: () => nextFrame(16)};
}
const runUntil = (lab, done, limit) => { let n = 0; while (!done() && n++ < limit) lab.step(); return n; };
async function load(el, payload) {
  await el('importFile').onchange({target:{files:[{text:async()=>JSON.stringify(payload)}], value:'fixture.json'}});
}
async function run() {
  const {lab, el, render} = boot();
  const profiles = lab.courseProfiles();
  same(Object.keys(profiles), ['training','curves','oval','hairpin','reverse','nuerburgring']);
  same(profiles.training.nodes, [
    [260,630],[130,480],[160,250],[340,155],[620,155],[790,270],
    [1030,200],[1080,420],[900,610],[670,620],[530,450],[390,520],
  ]);
  assert.equal(profiles.nuerburgring.points.length, 1029);

  // 1) Physik-Parität mit v1: Flos exportierter Fahrer muss die in v1 protokollierten
  //    Testfahrten exakt wiederholen (gleiche Zeit auf 1/60 s).
  const v1File = path.join(root, '..', 'racing-training.json');
  if (fs.existsSync(v1File)) {
    const v1 = JSON.parse(fs.readFileSync(v1File, 'utf8'));
    await load(el, v1);
    const expected = {};
    for (const r of v1.testResults) expected[r.trackId] = r;
    for (const [id, r] of Object.entries(expected)) {
      lab.switchCourse(id); lab.beginTest();
      runUntil(lab, () => !lab.stats().running, 20000);
      const got = lab.stats().testResults.at(-1);
      assert.equal(got.reason, r.reason, id);
      assert(Math.abs(got.time - r.time) < 1e-9, `${id}: ${got.time} vs v1 ${r.time}`);
      console.log(`  Parität v1 → v2 ${id.padEnd(8)} ${got.time.toFixed(4)} s = ${r.time.toFixed(4)} s ✓`);
    }
    lab.switchCourse('nuerburgring'); lab.beginTest();
    runUntil(lab, () => !lab.stats().running, 40000);
    const ring = lab.stats().testResults.at(-1);
    console.log(`  Flos Fahrer auf dem Nürburgring: ${ring.progressPercent.toFixed(1)} % nach ${ring.time.toFixed(2)} s (${ring.reason})`);
  }

  // Bestzeit je Strecke: aus Testfahrten übernommen und angezeigt
  const laps = lab.stats().bestLaps;
  if (fs.existsSync(v1File)) {
    assert(Math.abs(laps.hairpin - 18.9833) < 1e-3 && Math.abs(laps.nuerburgring - 151.7167) < 1e-3, JSON.stringify(laps));
    lab.switchCourse('hairpin'); render();
    assert.equal(el('bestLap').textContent, '18.98 s');
  }

  // 2) Testfahrten verändern Gewichte und Bestwerte nicht.
  const model = Array(122).fill(0);
  model[111] = .7;
  await load(el, {formatVersion:1, architecture:[9,10,2], bestWeights:model, bestScore:80, bestProgress:100, records:[], samples:[]});
  const baseline = lab.stats();
  assert(saved.has('racing-lab-v2-driver-training'));
  for (const id of Object.keys(profiles)) {
    lab.switchCourse(id);
    assert.equal(el('toggle').disabled, id !== 'training');
    lab.beginTest();
    const before = lab.stats();
    runUntil(lab, () => !lab.stats().running, 40000);
    const after = lab.stats();
    assert.equal(after.running, false, 'Test did not finish on ' + id);
    same(after.weights, before.weights);
    same(after.incumbent, baseline.incumbent);
    assert.equal(after.bestScore, baseline.bestScore);
    assert.equal(after.testResults.at(-1).trackId, id);
    render();
    assert(/^translate\(\S+ \S+\)$/.test(el('vehicle-position').attributes.transform));
  }
  el('exportLog').onclick();
  const data = JSON.parse(await exported.text());
  assert.equal(data.trainingTrackId, 'training');
  // Protokollangaben: Datum, Trainingsstrecke, Physik, Lernverfahren
  assert.equal(data.meta.trainingTrack, 'Testkurs 01 · Trainingsstrecke');
  assert.equal(data.meta.physics, 'ohne Haftungsgrenze (v1)');
  assert(/^\d{4}-\d\d-\d\dT/.test(data.meta.exportedAt));
  const lastTest = data.testResults.at(-1);
  for (const k of ['date', 'physics', 'algorithm', 'trainedOn']) assert(lastTest[k], 'Testprotokoll ohne ' + k);
  assert(/\d{4}-\d\d-\d\d \d\d:\d\d \| /.test(el('transferResults').textContent), 'Protokollzeile ohne Datum');
  assert.equal(data.courseProfiles.length, 6);

  // 3) Population: eine Generation mit 40 Wagen läuft durch und erzeugt die nächste.
  lab.switchCourse('training');
  el('toggle').onclick();
  let s = lab.stats();
  assert.equal(s.running, true); assert.equal(s.cars, 40);
  const gen = s.generation;
  runUntil(lab, () => lab.stats().generation > gen, 20000);
  s = lab.stats();
  assert.equal(s.generation, gen + 1); assert.equal(s.cars, 40);
  assert(s.bestScore >= baseline.bestScore);
  render();

  // 4) Einzelwagen-Modus (v1-Verfahren) bleibt verfügbar.
  lab.setMethod('single');
  el('toggle').onclick(); el('toggle').onclick();
  assert.equal(lab.stats().cars, 1);
  const att = lab.stats().attempt;
  runUntil(lab, () => lab.stats().attempt > att, 20000);
  assert(lab.stats().attempt > att);
  lab.setMethod('population');
  el('toggle').onclick();

  // 5) Eigener Fahrer für den Nürburgring; Training dort, Fahrerstände getrennt.
  lab.switchDriver('nuerburgring');
  assert.equal(lab.stats().incumbent, undefined);
  lab.switchCourse('nuerburgring');
  assert.equal(el('toggle').disabled, false);
  el('toggle').onclick();
  runUntil(lab, () => lab.stats().generation > 1, 60000);
  assert.equal(lab.stats().generation, 2);
  assert(saved.has('racing-lab-v2-driver-nuerburgring'));
  render();
  lab.switchDriver('training');
  same(lab.stats().incumbent && lab.stats().incumbent.length, 122);

  // 6) Haftungsgrenze: eigene Fahrerstände je Physik, Training läuft.
  lab.switchPhysics('slide');
  assert.equal(lab.stats().physics, 'slide');
  assert.equal(lab.stats().incumbent, undefined);
  lab.switchCourse('training');
  el('toggle').onclick();
  runUntil(lab, () => lab.stats().generation > 1, 20000);
  assert.equal(lab.stats().generation, 2);
  assert(saved.has('racing-lab-v2-driver-training-slide'));
  assert(!saved.has('racing-lab-v2-driver-training-grip'));
  render();
  lab.switchPhysics('v1');
  assert.equal(lab.stats().bestScore >= baseline.bestScore, true);

  // 6b) Abstandsregel: eigener Fahrerstand, Training läuft
  lab.switchScoring('abstand');
  assert.equal(lab.stats().scoring, 'abstand');
  lab.switchCourse('training'); el('toggle').onclick();
  runUntil(lab, () => lab.stats().generation > 1, 20000);
  assert(saved.has('racing-lab-v2-driver-training-abstand'));
  // Lenkruhe und Kombination: eigene Fahrerstände
  lab.switchScoring('abstand+ruhe'); assert.equal(lab.stats().scoring, 'abstand+ruhe');
  el('toggle').onclick(); const g0 = lab.stats().generation;
  runUntil(lab, () => lab.stats().generation > g0, 20000);
  assert(saved.has('racing-lab-v2-driver-training-abstand+ruhe'));
  lab.switchScoring('standard');

  // 7) Neustart lädt Zustand; "Neu beginnen" löscht nur den aktiven Fahrer.
  const reloaded = boot();
  assert.equal(reloaded.lab.stats().driverId, 'training');
  reloaded.lab.reset();
  assert.equal(saved.has('racing-lab-v2-driver-training'), false);
  assert(saved.has('racing-lab-v2-driver-nuerburgring'));
  assert.equal(reloaded.lab.stats().generation, 1);
  // 8) Parität Python → Browser: Jeder in Python trainierte Fahrer fährt hier dieselbe Zeit.
  const dir = path.join(root, 'fahrer');
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : []) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const ref = (data.testResults || []).at(-1);
    if (!ref) continue;
    await load(reloaded.el, data);
    assert.equal(reloaded.lab.stats().scoring, data.scoring?.model ?? 'standard', f);
    const want = data.physics?.model !== 'kamm' ? 'v1' : (data.physics.slide ?? 1) === 1 ? 'grip' : 'slide';
    assert.equal(reloaded.lab.stats().physics, want, f);
    assert.equal(reloaded.lab.stats().method, data.population === 1 ? 'single' : 'population', f);
    reloaded.lab.switchCourse(ref.trackId); reloaded.lab.beginTest();
    runUntil(reloaded.lab, () => !reloaded.lab.stats().running, 60000);
    const got = reloaded.lab.stats().testResults.at(-1);
    assert.equal(got.reason, ref.reason, f);
    assert(Math.abs(got.time - ref.time) < 1e-9, `${f}: ${got.time} vs Python ${ref.time}`);
    // Mit Bewertungsmodell im Datensatz (Python ab v2.8): auch die Punktzahl muss exakt stimmen
    if (data.scoring && ref.trackId === data.trainingTrackId) {
      const sc = reloaded.lab.stats().car.score;
      assert(Math.abs(sc - data.bestScore) < 1e-6, `${f}: Score ${sc} vs Python ${data.bestScore}`);
    }
    console.log(`  Parität Python → Browser ${f.padEnd(36)} ${got.time.toFixed(4)} s ✓`);
  }
  console.log('PASS: v1-Parität, 6 Strecken, eingefrorene Testgewichte, Population (Generation 1→2),');
  console.log('      Einzelwagen-Modus, getrennte Fahrer, Haftungsgrenze, Import/Export,');
  console.log('      Neustart/Reset, Parität Python → Browser.');
  console.log('Hinweis: Rechen- und Zustandstests mit DOM-Ersatz; keine Pixelprüfung.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
