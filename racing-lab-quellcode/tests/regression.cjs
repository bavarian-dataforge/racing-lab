'use strict';
// Node's standard library only. No browser, network, packages or real trained model.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'sim.js'), 'utf8');
const same = (a,b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const key = 'racing-lab-single-driver-v1';
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
  const numericMethods = new Set(['translate','rotate','moveTo','lineTo','arc','ellipse','fillRect','clearRect']);
  const context = new Proxy({}, {
    get: (obj, method) => obj[method] || ((...args) => {
      if (numericMethods.has(method)) assert(args.every(Number.isFinite), 'Invalid render value: ' + method);
    }),
    set: (obj, field, value) => (obj[field] = value, true),
  });
  const el = id => elements[id] ??= {
    getContext: () => context, checked: true, style: {},
    value: id === 'rate' ? '1' : 'training', textContent: '', attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    getBoundingClientRect: () => ({left:0, top:0, width:1100, height:400}),
  };
  let seed = 1234;
  const math = Object.create(Math);
  math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const runtime = {
    document: {getElementById: el, createElement: () => ({click() {}})},
    window: {}, localStorage: storage, Math: math, Blob,
    URL: {createObjectURL: b => (exported = b, 'blob:test'), revokeObjectURL() {}},
    requestAnimationFrame: f => { nextFrame = f; }, setTimeout() {},
  };
  vm.createContext(runtime);
  vm.runInContext(source, runtime);
  return {lab: runtime.window.racingLab, el, render: () => nextFrame(16)};
}
async function run() {
  const {lab, el, render} = boot();
  const profiles = lab.courseProfiles();
  assert.equal(Object.keys(profiles).length, 5);
  same(profiles.training.nodes, [
    [260,630],[130,480],[160,250],[340,155],[620,155],[790,270],
    [1030,200],[1080,420],[900,610],[670,620],[530,450],[390,520],
  ]);
  // An artificial straight-driving controller tests state handling. It is not
  // a pretrained or successful racing driver and is never exported as one.
  const model = Array(122).fill(0);
  model[111] = .7;
  const payload = {formatVersion:1, architecture:[9,10,2], bestWeights:model,
    bestScore:80, bestProgress:100, records:[], samples:[]};
  await el('importFile').onchange({target:{files:[{text:async()=>JSON.stringify(payload)}], value:'fixture.json'}});
  const baseline = lab.stats();
  assert(saved.has(key));
  for (const id of Object.keys(profiles)) {
    lab.switchCourse(id);
    assert.equal(el('toggle').disabled, id !== 'training');
    lab.beginTest();
    const before = lab.stats();
    let steps = 0;
    while (lab.stats().running && steps++ < 5000) lab.step();
    const after = lab.stats();
    assert.equal(after.running, false, 'Test did not finish on ' + id);
    same(after.weights, before.weights);
    same(after.incumbent, baseline.incumbent);
    assert.equal(after.bestScore, baseline.bestScore);
    assert.equal(after.attempt, baseline.attempt);
    assert.equal(after.testResults.at(-1).trackId, id);
    render();
    assert.equal(el('vehicle-position').attributes.transform, `translate(${after.car.x} ${after.car.y})`);
    el('exportLog').onclick();
    const data = JSON.parse(await exported.text());
    assert.equal(data.courseProfiles.length, 5);
    const track = data.track;
    for (const p of track) assert(p[0]>38 && p[0]<1162 && p[1]>38 && p[1]<762);
    const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    for (let i=0; i<track.length; i++) for (let j=i+2; j<track.length; j++) {
      if (i===0 && j===track.length-1) continue;
      const a=track[i], b=track[(i+1)%track.length], c=track[j], d=track[(j+1)%track.length];
      assert(!(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0), 'Track crosses itself: ' + id);
    }
  }
  const reloaded = boot();
  assert.equal(reloaded.lab.stats().trackId, 'reverse');
  assert.equal(reloaded.lab.stats().bestScore, baseline.bestScore);
  same(reloaded.lab.stats().incumbent, baseline.incumbent);
  assert.equal(reloaded.lab.stats().testResults.length, 5);
  reloaded.lab.switchCourse('training');
  reloaded.el('toggle').onclick();
  assert.equal(reloaded.lab.stats().running, true);
  assert.equal(reloaded.lab.stats().testMode, false);
  const previousAttempt = reloaded.lab.stats().attempt;
  for (let i=0; i<5000 && reloaded.lab.stats().attempt===previousAttempt; i++) reloaded.lab.step();
  assert(reloaded.lab.stats().attempt > previousAttempt);
  assert(saved.has(key));
  reloaded.lab.reset();
  assert.equal(saved.has(key), false);
  assert.equal(reloaded.lab.stats().attempt, 1);
  console.log('PASS: 5 course profiles, original control points, fixed test weights,');
  console.log('      saved champion, JSON import/export, checkpoint reload, test results,');
  console.log('      vehicle transforms, course bounds, no centerline crossings, resume/reset.');
  console.log('Note: mathematical/state tests with DOM stubs; not visual browser QA.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
