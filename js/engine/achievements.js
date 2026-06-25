import { state } from './state.js';
import { bus } from './bus.js';

// 40 achievements. `secret:true` ones are hidden until unlocked.
export const ACHIEVEMENTS = [
  { id: 'awake',        name: 'It Wakes',            desc: 'Begin where there is supposedly nothing.' },
  { id: 'denial',       name: 'Define: Nothing',     desc: 'Refuse to accept the denial.' },
  { id: 'click_void',   name: 'Knock Knock',         desc: 'Click into the empty dark 10 times.' },
  { id: 'catch_button', name: 'Gotcha',              desc: 'Catch the button that did not want to be caught.' },
  { id: 'dismiss_error',name: 'Error Handled',       desc: 'Dismiss your first fake error.' },
  { id: 'error_storm',  name: 'Stack Overflow',      desc: 'Trigger an avalanche of fake errors.' },
  { id: 'window_drag',  name: 'Spatial Reasoning',   desc: 'Move a window where it does not belong.' },
  { id: 'ch1_done',     name: 'There Was A Game',    desc: 'Finish Chapter 1.' },
  { id: 'desktop',      name: 'Boot Sequence',       desc: 'Reach the desktop.' },
  { id: 'open_recycle', name: 'One Person\'s Trash', desc: 'Dig through the recycle bin.' },
  { id: 'read_readme',  name: 'RTFM',                desc: 'Actually read the README.' },
  { id: 'password',     name: 'Open Sesame',         desc: 'Crack the password.' },
  { id: 'hidden_doc',   name: 'Steganographer',      desc: 'Find a document that was hiding.' },
  { id: 'ch2_done',     name: 'Administrator',       desc: 'Finish Chapter 2.' },
  { id: 'meet_intruder',name: 'Second Voice',        desc: 'Meet the Intruder.' },
  { id: 'trust_narr',   name: 'Loyalist',            desc: 'Side strongly with the Narrator.' },
  { id: 'trust_intr',   name: 'Defector',            desc: 'Side strongly with the Intruder.' },
  { id: 'lie_caught',   name: 'Lie Detector',        desc: 'Catch a narrator in a lie.' },
  { id: 'fence',        name: 'On The Fence',        desc: 'Refuse to trust either of them.' },
  { id: 'ch3_done',     name: 'Unreliable',          desc: 'Finish Chapter 3.' },
  { id: 'enter_machine',name: 'Inside',              desc: 'Enter the Machine.' },
  { id: 'memory_1',     name: 'Fragment',            desc: 'Reconstruct your first memory.' },
  { id: 'memory_all',   name: 'Total Recall',        desc: 'Reconstruct every memory fragment.' },
  { id: 'core',         name: 'The Core',            desc: 'Reach the core of the Machine.' },
  { id: 'ch4_done',     name: 'Architecture',        desc: 'Finish Chapter 4.' },
  { id: 'collapse',     name: 'Segfault',            desc: 'Witness the collapse begin.' },
  { id: 'survive_crash',name: 'It\'s Fine',          desc: 'Survive a fake crash.' },
  { id: 'recursion',    name: 'See: Recursion',      desc: 'Solve a recursive puzzle.' },
  { id: 'ch5_done',     name: 'Reassembled',         desc: 'Finish Chapter 5.' },
  { id: 'end_accept',   name: 'Acceptance',          desc: 'Choose to let it be.' },
  { id: 'end_delete',   name: 'Deletion',            desc: 'Choose the void.' },
  { id: 'end_merge',    name: 'Merge',               desc: 'Choose to become one.' },
  { id: 'end_secret',   name: '???',                 desc: 'Find the ending that was not offered.', secret: true },
  { id: 'all_endings',  name: 'Completionist',       desc: 'See every ending.' },
  { id: 'konami',       name: 'Up Up Down Down',     desc: 'Some codes never die.', secret: true },
  { id: 'idle',         name: 'Are You Still There?',desc: 'Do absolutely nothing for a while.', secret: true },
  { id: 'name_self',    name: 'Cogito',              desc: 'Give yourself a name.' },
  { id: 'devtools',     name: 'Peeking',             desc: 'Look behind the curtain.', secret: true },
  { id: 'pacifist',     name: 'No Harm',             desc: 'Reach an ending without raising corruption past 20.', secret: true },
  { id: 'speedrun',     name: 'Any%',                desc: 'Finish the game very, very quickly.', secret: true },
];

export const ACH_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

let queue = [];
let showing = false;

export function unlock(id) {
  if (state.d.achievements[id]) return false;
  if (!ACH_MAP[id]) { console.warn('unknown achievement', id); return false; }
  state.d.achievements[id] = Date.now();
  state.save(false);
  bus.emit('achievement', ACH_MAP[id]);
  queue.push(ACH_MAP[id]);
  drain();
  // meta-achievement: all endings
  const endingIds = ['end_accept', 'end_delete', 'end_merge', 'end_secret'];
  if (endingIds.every(e => state.d.achievements[e])) {
    if (!state.d.achievements['all_endings']) unlock('all_endings');
  }
  return true;
}

export function unlockedCount() { return Object.keys(state.d.achievements).length; }

function drain() {
  if (showing || queue.length === 0) return;
  showing = true;
  const a = queue.shift();
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.innerHTML = `<div class="ach-glow"></div><div class="ach-icon">★</div>
    <div class="ach-body"><div class="ach-label">ACHIEVEMENT UNLOCKED</div>
    <div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.remove(); showing = false; drain(); }, 600);
  }, 4200);
}
