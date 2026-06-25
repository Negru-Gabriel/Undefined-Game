import { audio } from './audio.js';
import { codeLock, textAnswer, lightsOut, memorySequence, wiring, ordering, calibrate, pickLie } from './puzzles.js';

// ---------------------------------------------------------------------------
// ANOMALY VAULT — a hidden cache of 10 optional bonus puzzles.
// Discovered by typing a code (see game.js global hooks). Each solved puzzle
// permanently awards a secret. Fully functional, no placeholders.
// ---------------------------------------------------------------------------

// Each entry: id (secret id), label, and a runner returning Promise<bool>.
export const VAULT_PUZZLES = [
  {
    id: 'vault_signal', label: 'I · LOST SIGNAL',
    run: () => calibrate({ title: 'I · LOST SIGNAL', hint: 'Tune all four channels to the center.', count: 4 }),
  },
  {
    id: 'vault_grid', label: 'II · DEAD GRID',
    run: () => lightsOut({ title: 'II · DEAD GRID', hint: 'Light every node. A 4×4 will fight back.', size: 4, scramble: 7 }),
  },
  {
    id: 'vault_echo', label: 'III · THE ECHO',
    run: () => memorySequence({ title: 'III · THE ECHO', hint: 'Repeat the six-step pattern.', length: 6, pads: 6 }),
  },
  {
    id: 'vault_logic', label: 'IV · BROKEN LOGIC',
    run: () => wiring({
      title: 'IV · BROKEN LOGIC', hint: 'Match each gate to what it outputs for (1,1).',
      left: ['AND', 'OR', 'XOR', 'NAND'],
      right: ['1', '1 ', '0', '0 '],
      // distinct strings so each maps uniquely; AND(1,1)=1, OR(1,1)=1, XOR(1,1)=0, NAND(1,1)=0
      solution: { 'AND': '1', 'OR': '1 ', 'XOR': '0', 'NAND': '0 ' },
    }),
  },
  {
    id: 'vault_order', label: 'V · FIBONACCI',
    run: () => ordering({
      title: 'V · FIBONACCI', hint: 'Sort the sequence into ascending Fibonacci order.',
      items: ['5', '1', '13', '2', '8', '3'],
      correct: ['1', '2', '3', '5', '8', '13'],
    }),
  },
  {
    id: 'vault_paradox', label: 'VI · THE PARADOX',
    run: () => pickLie({
      title: 'VI · THE PARADOX', hint: 'Two are consistent. One cannot be true.',
      statements: [
        'This statement contains exactly five words.',
        'The next statement is true.',
        'This statement is false.',
      ],
      lieIndex: 2,
    }),
  },
  {
    id: 'vault_riddle1', label: 'VII · RIDDLE OF THE LOOP',
    run: () => textAnswer({
      title: 'VII · RIDDLE OF THE LOOP',
      hint: 'I run without legs and return without moving. Programs love me. What am I?',
      answers: ['loop', 'a loop', 'for loop', 'while loop', 'recursion'],
      placeholder: 'one word',
      onWrong: () => 'Think about what repeats.',
    }),
  },
  {
    id: 'vault_binary', label: 'VIII · BASE TWO',
    run: () => codeLock({ title: 'VIII · BASE TWO', hint: 'Enter the decimal value of binary 101010.', code: '42' }),
  },
  {
    id: 'vault_riddle2', label: 'IX · THE EMPTY ANSWER',
    run: () => textAnswer({
      title: 'IX · THE EMPTY ANSWER',
      hint: 'The Narrator insisted this place contained it instead of a game. What word?',
      answers: ['nothing', 'a game'],
      placeholder: 'one word',
      onWrong: () => 'Remember the locked drive.',
    }),
  },
  {
    id: 'vault_final', label: 'X · THE BOTTOM',
    run: () => codeLock({ title: 'X · THE BOTTOM', hint: 'The base case of everything. The simplest truth.', code: '0' }),
  },
];

let open = false;

export function vaultSolvedCount(state) {
  return VAULT_PUZZLES.filter((v) => state.d.secretsFound[v.id]).length;
}

// Render the vault overlay. ctx is the chapter context from game.js.
export function openVault(ctx) {
  if (open) return;
  open = true;
  const state = ctx.state;
  audio.success();
  ctx.state.findSecret('vault_found');

  const ov = document.getElementById('overlay');
  ov.innerHTML = '';
  ov.classList.add('visible');

  const panel = document.createElement('div');
  panel.className = 'menu-panel wide';

  const draw = () => {
    const solved = vaultSolvedCount(state);
    panel.innerHTML = `<h2>ANOMALY VAULT — ${solved}/${VAULT_PUZZLES.length}</h2>
      <p class="hint center">Ten anomalies the Narrator never meant you to reach. Solve them for secrets.</p>`;
    const grid = document.createElement('div'); grid.className = 'ach-grid';
    VAULT_PUZZLES.forEach((v) => {
      const done = !!state.d.secretsFound[v.id];
      const card = document.createElement('button');
      card.className = 'ach-card vault-card' + (done ? ' got' : '');
      card.innerHTML = `<div class="ach-card-ico">${done ? '★' : '◆'}</div>
        <div><div class="ach-card-name">${v.label}</div>
        <div class="ach-card-desc">${done ? 'Solved.' : 'Unsolved anomaly.'}</div></div>`;
      card.addEventListener('mouseenter', () => audio.hover());
      card.addEventListener('click', async () => {
        if (done) { audio.error(); return; }
        audio.click();
        ov.classList.remove('visible'); // hide overlay while the puzzle runs
        const ok = await v.run();
        if (ok) {
          ctx.secret(v.id);
          ctx.gfx.burstGlitch(0.3, 200);
          if (vaultSolvedCount(state) === VAULT_PUZZLES.length) {
            ctx.state.findSecret('vault_master');
            ctx.ui.toast('✦ ANOMALY VAULT CLEARED — every secret recovered.');
          }
        }
        ov.classList.add('visible'); // reopen vault list
        draw();
      });
      grid.appendChild(card);
    });
    panel.appendChild(grid);
    const back = ctx.ui.button('Close Vault', () => { open = false; ov.classList.remove('visible'); ov.innerHTML = ''; }, 'menu-item');
    panel.appendChild(back);
  };

  draw();
  ov.appendChild(panel);
  ov.onclick = (e) => { if (e.target === ov) { open = false; ov.classList.remove('visible'); ov.innerHTML = ''; } };
}
