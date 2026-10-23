'use strict';
// Node's standard library only. No browser, network or packages.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const sources = ['i18n.js', 'tracks/nuerburgring.js', 'sim.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8'));
const same = (a,b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
// Files from before v3.0 store German result texts; compare them in English.
const LEGACY = {'Runde geschafft!': 'Lap completed!', 'Wandkontakt': 'Wall contact', 'Kein Fortschritt': 'No progress', 'Zeitlimit': 'Time limit'};
const reason = r => LEGACY[r] || r;
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
  const defaults = {rate: '1', popSize: '40', method: 'population', driver: 'training', physics: 'slide', scoring: 'standard', lang: 'en'};
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

  // 1) Physics parity with v1: Flo's exported driver must repeat the test runs logged in v1
  //    exactly (same time to 1/60 s).
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
      assert.equal(got.reason, reason(r.reason), id);
      assert(Math.abs(got.time - r.time) < 1e-9, `${id}: ${got.time} vs v1 ${r.time}`);
      console.log(`  parity v1 → v2 ${id.padEnd(8)} ${got.time.toFixed(4)} s = ${r.time.toFixed(4)} s ✓`);
    }
    lab.switchCourse('nuerburgring'); lab.beginTest();
    runUntil(lab, () => !lab.stats().running, 40000);
    const ring = lab.stats().testResults.at(-1);
    console.log(`  Flo's driver on the Nürburgring: ${ring.progressPercent.toFixed(1)} % after ${ring.time.toFixed(2)} s (${ring.reason})`);
  }

  // Best lap per track: taken over from test runs and displayed
  const laps = lab.stats().bestLaps;
  if (fs.existsSync(v1File)) {
    assert(Math.abs(laps.hairpin - 18.9833) < 1e-3 && Math.abs(laps.nuerburgring - 151.7167) < 1e-3, JSON.stringify(laps));
    lab.switchCourse('hairpin'); render();
    assert.equal(el('bestLap').textContent, '18.98 s');
  }

  // 2) Test runs do not change weights or best values.
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
  // Log details in English: date, training track, physics, learning method
  assert.equal(data.meta.trainingTrack, 'Test track 01 · Training track');
  assert.equal(data.meta.physics, 'no grip limit (v1)');
  assert(/^\d{4}-\d\d-\d\dT/.test(data.meta.exportedAt));
  const lastTest = data.testResults.at(-1);
  for (const k of ['date', 'physics', 'algorithm', 'trainedOn', 'physicsModel', 'scoringModel']) assert(lastTest[k], 'test log without ' + k);
  assert(/\d{4}-\d\d-\d\d \d\d:\d\d \| /.test(el('transferResults').textContent), 'log line without date');
  assert.equal(data.courseProfiles.length, 6);

  // 2b) Language switch: the same log is shown in German, the data stay English.
  el('lang').onchange({target: {value: 'de'}});
  assert.match(el('transferResults').textContent, /Testkurs 05 · Gegenrichtung \| Fahrer Testkurs 01 \| ohne Haftungsgrenze \(v1\)/);
  assert.match(el('courseNotice').textContent, /Prüfstrecke|Training und unveränderte/);
  el('lang').onchange({target: {value: 'en'}});
  assert.match(el('transferResults').textContent, /Test track 05 · Reverse direction \| Driver Test track 01 \| no grip limit \(v1\)/);

  // 3) Population: one generation with 40 cars runs through and creates the next one.
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

  // 4) Single-car mode (v1 method) stays available.
  lab.setMethod('single');
  el('toggle').onclick(); el('toggle').onclick();
  assert.equal(lab.stats().cars, 1);
  const att = lab.stats().attempt;
  runUntil(lab, () => lab.stats().attempt > att, 20000);
  assert(lab.stats().attempt > att);
  lab.setMethod('population');
  el('toggle').onclick();

  // 5) Separate driver for the Nürburgring; training there, driver states kept apart.
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

  // 6) Grip limit: separate driver states per physics, training runs.
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

  // 6b) Clearance rule: separate driver state, training runs
  lab.switchScoring('abstand');
  assert.equal(lab.stats().scoring, 'abstand');
  lab.switchCourse('training'); el('toggle').onclick();
  runUntil(lab, () => lab.stats().generation > 1, 20000);
  assert(saved.has('racing-lab-v2-driver-training-abstand'));
  // Steering calm and the combination: separate driver states
  lab.switchScoring('abstand+ruhe'); assert.equal(lab.stats().scoring, 'abstand+ruhe');
  el('toggle').onclick(); const g0 = lab.stats().generation;
  runUntil(lab, () => lab.stats().generation > g0, 20000);
  assert(saved.has('racing-lab-v2-driver-training-abstand+ruhe'));
  lab.switchScoring('standard');

  // 7) Reload restores the state; "Start over" deletes only the active driver.
  const reloaded = boot();
  assert.equal(reloaded.lab.stats().driverId, 'training');
  reloaded.lab.reset();
  assert.equal(saved.has('racing-lab-v2-driver-training'), false);
  assert(saved.has('racing-lab-v2-driver-nuerburgring'));
  assert.equal(reloaded.lab.stats().generation, 1);
  // 8) Parity Python/browser exports → browser code: every saved driver drives the same time here.
  const dir = path.join(root, 'drivers');
  let checked = 0;
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
    assert.equal(got.reason, reason(ref.reason), f);
    assert(Math.abs(got.time - ref.time) < 1e-9, `${f}: ${got.time} vs logged ${ref.time}`);
    // With a scoring model in the file (Python from v2.8): the score must match exactly too
    if (data.scoring && ref.trackId === data.trainingTrackId) {
      const sc = reloaded.lab.stats().car.score;
      assert(Math.abs(sc - data.bestScore) < 1e-6, `${f}: score ${sc} vs logged ${data.bestScore}`);
    }
    checked++;
    console.log(`  parity file → browser ${f.padEnd(58)} ${got.time.toFixed(4)} s ✓`);
  }
  assert(checked >= 10, `only ${checked} driver files checked – wrong folder?`);
  console.log('PASS: v1 parity, 6 tracks, frozen test weights, language switch, population (generation 1→2),');
  console.log('      single-car mode, separate drivers, grip limit, scorings, import/export,');
  console.log('      reload/reset, parity of all saved drivers.');
  console.log('Note: calculation and state tests with a DOM stand-in; no pixel checks.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
