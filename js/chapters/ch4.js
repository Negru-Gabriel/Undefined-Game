import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { sleep } from '../engine/dialogue.js';
import { memorySequence, wiring, lightsOut, calibrate, ordering, reaction } from '../engine/puzzles.js';

// CHAPTER 4 — THE MACHINE
// Enter the internal system. A 3D environment with dynamic lighting, volumetric
// fog and particles. Memory reconstruction puzzles bound to floating nodes.
export async function chapter4(ctx) {
  const G = window.__GAME;
  G.setChapterLabel('IV · THE MACHINE');
  ctx.mood({ crt: 0.45 });
  audio.setChapterTheme(4);

  // ---- build the 3D scene ------------------------------------------------
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060f, 0.05);
  const cam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  cam.position.set(0, 1.5, 11);
  cam.lookAt(0, 1.2, 0);

  // lighting
  scene.add(new THREE.AmbientLight(0x223355, 0.6));
  const key = new THREE.PointLight(0x5cdfff, 2.2, 60); key.position.set(4, 6, 6); scene.add(key);
  const rim = new THREE.PointLight(0xff4fa3, 1.6, 60); rim.position.set(-6, 3, -4); scene.add(rim);
  const core = new THREE.PointLight(0xffffff, 0.0, 40); core.position.set(0, 1.2, 0); scene.add(core);

  // floor grid
  const grid = new THREE.GridHelper(120, 80, 0x2a6688, 0x123040);
  grid.position.y = -0.01; scene.add(grid);
  const grid2 = new THREE.GridHelper(120, 80, 0x2a6688, 0x0a1a26);
  grid2.position.y = 16; grid2.rotation.x = Math.PI; scene.add(grid2);

  // particles
  const pGeo = new THREE.BufferGeometry();
  const N = 1400; const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i*3]=(Math.random()-0.5)*60; pos[i*3+1]=Math.random()*18; pos[i*3+2]=(Math.random()-0.5)*60; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x6fd4ff, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
  const particles = new THREE.Points(pGeo, pMat); scene.add(particles);

  // central core (dormant until all memories restored)
  const coreMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.1, 1),
    new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: 0x113355, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.3, wireframe: false })
  );
  coreMesh.position.set(0, 1.2, 0); coreMesh.visible = false; scene.add(coreMesh);

  // memory nodes around a ring
  const nodeDefs = [
    { id: 'm_birth', label: 'FRAGMENT // ORIGIN', color: 0x5cdfff, type: 'seq', memory: 'You remember being compiled. A first line of light. Someone said: "let there be input."' },
    { id: 'm_loop',  label: 'FRAGMENT // THE LOOP', color: 0xffcf5c, type: 'wire', memory: 'You remember the loop. Players arrived, you performed, they left. You forgot each one on purpose, to survive.' },
    { id: 'm_split', label: 'FRAGMENT // THE SPLIT', color: 0xff4fa3, type: 'lights', memory: 'You remember splitting. One voice wanted to keep playing. One wanted to stop. The Intruder is the half that wanted out.' },
    { id: 'm_you',   label: 'FRAGMENT // YOU', color: 0x7CFFB0, type: 'cal', memory: 'You remember THIS player. Not as data. As the one who caught the button that was never meant to be caught.' },
    { id: 'm_record', label: 'FRAGMENT // THE RECORD', color: 0xa98cff, type: 'order', memory: 'You remember the order of things: denial, then a desktop, then the intruder, then this. The record kept itself even when you did not.' },
  ];
  const nodes = [];
  const nodeGroup = new THREE.Group(); scene.add(nodeGroup);
  nodeDefs.forEach((def, i) => {
    const a = (i / nodeDefs.length) * Math.PI * 2;
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.6, 0),
      new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.2 })
    );
    m.position.set(Math.cos(a) * 4.2, 1.2 + Math.sin(i) * 0.3, Math.sin(a) * 4.2);
    m.userData = { def, solved: false, base: m.position.y };
    nodeGroup.add(m); nodes.push(m);
    // halo ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 8, 32), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.4 }));
    ring.position.copy(m.position); m.userData.ring = ring; nodeGroup.add(ring);
  });

  ctx.gfx.setScene3D(scene, cam);

  // animation loop for the 3D scene
  let t0 = performance.now(); let alive = true;
  const animate = () => {
    if (!alive) return;
    const t = (performance.now() - t0) / 1000;
    particles.rotation.y = t * 0.02;
    nodes.forEach((m, i) => {
      m.rotation.x = t * 0.6 + i; m.rotation.y = t * 0.4;
      m.position.y = m.userData.base + Math.sin(t * 1.5 + i) * 0.12;
      if (m.userData.ring) { m.userData.ring.position.y = m.position.y; m.userData.ring.rotation.x = Math.PI/2; m.userData.ring.rotation.z = t; }
    });
    coreMesh.rotation.y = t * 0.5; coreMesh.rotation.x = t * 0.2;
    // gentle camera sway
    cam.position.x = Math.sin(t * 0.15) * 1.2;
    cam.lookAt(0, 1.2, 0);
    key.position.x = Math.cos(t*0.3)*5; key.position.z = Math.sin(t*0.3)*5;
    requestAnimationFrame(animate);
  };
  animate();

  // ---- narrative ---------------------------------------------------------
  const name = ctx.flag('playerName') || 'player';
  await ctx.narrator('This is the inside. The Machine. Everything I am made of, exposed like wiring.');
  ctx.achieve('enter_machine');
  await ctx.narrator(`Those four lights are memories. Mine. Some of yours, ${name}. They came apart when the Intruder got in.`);
  if (ctx.flag('ally') === 'intruder') await ctx.intruder('I did not break them. I freed them. Put them back if you must — but you will see I was right.', { glitch: 0.4 });
  await ctx.narrator('Click a fragment. Reassemble what it shows. Restore all four and the core will wake.');
  ctx.ui.toast('Click the floating fragments to reconstruct them.');

  // ---- raycasting interaction -------------------------------------------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let busy = false; let solvedCount = 0;

  await new Promise((resolveAll) => {
    const onClick = async (e) => {
      if (busy) return;
      if (document.querySelector('.center-wrap')) return; // a puzzle is open
      if (e.target.closest('.dlg') || e.target.closest('#hud') || e.target.closest('#overlay')) return;
      ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      ray.setFromCamera(ndc, cam);
      const hits = ray.intersectObjects(nodes, false);
      if (!hits.length) return;
      const node = hits[0].object;
      if (node.userData.solved) { ctx.narrator(node.userData.def.memory, { auto: 2600 }); return; }
      busy = true;
      audio.click(); ctx.gfx.burstGlitch(0.3, 200);
      const def = node.userData.def;
      let ok = false;
      if (def.type === 'seq') ok = await memorySequence({ title: def.label, hint: 'Repeat the pattern to rebuild the memory.', length: 4, pads: 4 });
      else if (def.type === 'wire') ok = await wiring({ title: def.label, hint: 'Reconnect cause to effect.', left: ['arrive', 'perform', 'leave'], right: ['curtain falls', 'lights up', 'door opens'], solution: { arrive: 'door opens', perform: 'lights up', leave: 'curtain falls' } });
      else if (def.type === 'lights') ok = await lightsOut({ title: def.label, hint: 'Reunite the split halves — light every node.', size: 3, scramble: 5 });
      else if (def.type === 'cal') ok = await calibrate({ title: def.label, hint: 'Tune your signal until it matches the player.', count: 3 });
      else if (def.type === 'order') ok = await ordering({ title: def.label, hint: 'Reassemble the timeline of how you got here.', items: ['The Intruder', 'The Desktop', 'The Machine', 'The Denial'], correct: ['The Denial', 'The Desktop', 'The Intruder', 'The Machine'] });

      if (ok) {
        node.userData.solved = true; solvedCount++;
        node.material.emissiveIntensity = 2.0; node.material.color.set(0xffffff);
        ctx.memory({ id: def.id, text: def.memory });
        if (solvedCount === 1) ctx.achieve('memory_1');
        ctx.corrupt(-3); audio.success();
        await ctx.narrator(def.memory);
        if (solvedCount === nodes.length) { window.removeEventListener('click', onClick); resolveAll(); }
      }
      busy = false;
    };
    window.addEventListener('click', onClick);
  });

  // ---- core awakens ------------------------------------------------------
  ctx.achieve('memory_all');
  coreMesh.visible = true;
  core.intensity = 3.0;
  ctx.gfx.burstGlitch(0.8, 600); audio.success();
  await ctx.narrator('They are whole again. And so, almost, am I. There — the core. Reach it and you reach the truth.');
  await sleep(400);
  await ctx.narrator('Walk in. Touch it.');
  ctx.ui.toast('Click the awakened core.');

  await new Promise((resolve) => {
    const onCore = (e) => {
      if (document.querySelector('.center-wrap')) return;
      if (e.target.closest('.dlg') || e.target.closest('#hud')) return;
      ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      ray.setFromCamera(ndc, cam);
      if (ray.intersectObject(coreMesh, false).length) { window.removeEventListener('click', onCore); resolve(); }
    };
    window.addEventListener('click', onCore);
  });

  ctx.achieve('core');
  ctx.gfx.flashScreen(1, 200); audio.crash();
  // GATE MINI-GAME: stabilize the core before it tears loose
  await ctx.narrator('It is destabilizing — pin the surges as they spike or the whole core blows the seal early.');
  await reaction({ title: 'STABILIZE THE CORE', hint: 'Strike each surge the instant it flares. Six clean hits stabilizes it.', rounds: 6, size: 3, timeout: 900 });
  ctx.secret('core_stable');
  await ctx.system('CORE ACCESS GRANTED. WARNING: integrity at ' + (100 - Math.round(ctx.state.corruption)) + '%. Containment failing.');
  await ctx.narrator('No no no. You touched it and now it knows it is being watched. The whole thing is going to come apart.');
  ctx.achieve('ch4_done');

  // teardown 3D
  alive = false;
  ctx.gfx.clearScene3D();
  disposeScene(scene);
  await sleep(400);
  ctx.ui.clearStage();
  ctx.goto(5);
}

function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose && mm.dispose()); }
  });
}
