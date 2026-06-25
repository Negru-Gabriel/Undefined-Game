import { Game } from './engine/game.js';
import { state } from './engine/state.js';
import { audio } from './engine/audio.js';
import { bus } from './engine/bus.js';
import * as ACH from './engine/achievements.js';
import { sleep } from './engine/dialogue.js';

import { chapter1 } from './chapters/ch1.js';
import { chapter2 } from './chapters/ch2.js';
import { chapter3 } from './chapters/ch3.js';
import { chapter4 } from './chapters/ch4.js';
import { chapter5 } from './chapters/ch5.js';
import { chapter6 } from './chapters/ch6.js';
import { endings } from './chapters/endings.js';

const game = new Game();
game.register(1, chapter1);
game.register(2, chapter2);
game.register(3, chapter3);
game.register(4, chapter4);
game.register(5, chapter5);
game.register(6, chapter6);
game.register('ending', endings);
window.__GAME = game; // for debugging / chapter cross-calls

const settings = state.loadSettings();
audio.setVolume(settings.volume);
game.dlg.textSpeed = settings.textSpeed;

const title = document.getElementById('title');
const titleStart = document.getElementById('title-start');
const titleContinue = document.getElementById('title-continue');
const titleAch = document.getElementById('title-ach');
const titleSub = document.getElementById('title-sub');

function refreshTitle() {
  titleContinue.style.display = state.hasSave() ? 'inline-flex' : 'none';
  titleAch.textContent = `ACHIEVEMENTS · ${ACH.unlockedCount()}/${ACH.ACHIEVEMENTS.length}`;
}
refreshTitle();

async function bootAudio() {
  try { await audio.start(); audio.setIntensity(0.25); } catch (e) { console.warn('audio', e); }
}

async function beginGame(chapter, cp) {
  bootAudio(); // fire-and-forget: never block chapter start on autoplay policy
  title.classList.add('gone');
  await sleep(700);
  title.style.display = 'none';
  game.showHUD(true);
  game._startTime = Date.now();
  // speedrun timer baseline
  state.hv('sessionStart');
  state.startAutosave(12000);
  game.startChapter(chapter, cp);
}

titleStart.addEventListener('click', async () => {
  audio.click();
  // fresh run keeps achievements/endings but resets story progress
  const keepAch = state.d.achievements; const keepEnd = state.d.endings; const keepSecrets = state.d.secretsFound;
  state.reset();
  state.d.achievements = keepAch; state.d.endings = keepEnd; state.d.secretsFound = keepSecrets;
  ACH.unlock('awake');
  beginGame(1, 'start');
});

titleContinue.addEventListener('click', () => {
  audio.click();
  const ok = state.load();
  if (!ok) {
    // corrupt save -> recovery flow handled below
    if (state.recover()) { game.ui && game.ui.toast && null; }
  }
  const ch = Math.max(1, state.d.chapter || 1);
  beginGame(ch, state.d.checkpoint || 'start');
});

titleAch.addEventListener('click', () => { audio.click(); game.showAchievements(); });

document.getElementById('title-settings').addEventListener('click', () => { audio.click(); game.showSettings(); });

// corrupt-save detection -> offer in-fiction recovery on the title
bus.on('state:corrupt-detected', () => {
  titleSub.textContent = 'a save file was found, but it is... wrong.';
});

bus.on('achievement', () => refreshTitle());

// resume audio context on any gesture (browsers require it)
window.addEventListener('pointerdown', () => { if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); }, { once: false });

// speedrun achievement check fires from ending module via this helper
window.__checkSpeedrun = () => {
  const mins = (Date.now() - game._startTime) / 60000;
  if (mins < 8) ACH.unlock('speedrun');
};

// dev: jump straight to a chapter with ?ch=N (1..6) — handy for testing
const _params = new URLSearchParams(location.search);
if (_params.has('ch')) {
  const n = Math.max(1, Math.min(6, parseInt(_params.get('ch'), 10) || 1));
  ACH.unlock('awake');
  beginGame(n, 'start');
}

console.log('%cUNDEFINED', 'color:#5cf;font-size:20px');
console.log('%cThere is nothing in here. Stop looking. ...Unless?', 'color:#f5c');
