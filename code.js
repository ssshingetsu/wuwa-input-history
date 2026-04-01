const EXPIRE_TIME = 1800;
const TOTAL_LINES = 19;
let intervalId;
let currentInput = 0;
let cycles = 0;

let inputHistory = [];
let cyclesHistory = [];
let inputAge = [];
let pressCount = [];
let isAlternatingCombo = []; // Track which combos are from alternation (true) vs simultaneous (false)

let keysPressed = new Set();
let mousePressed = new Set();
let lmbHoldStart = 0;
const HEAVY_ATTACK_THRESHOLD = 350;

// bitmask mapping for all tracked keys
const keyMapping = {
  'w': 1 << 0,
  'a': 1 << 1,
  's': 1 << 2,
  'd': 1 << 3,
  'q': 1 << 4,
  'e': 1 << 5,
  'r': 1 << 6,
  'f': 1 << 7,
  'space': 1 << 8,
  'mouse0': 1 << 9,
  'mouse2': 1 << 10,
  '1': 1 << 11,
  '2': 1 << 12,
  '3': 1 << 13,
  'heavy': 1 << 14
};

// display names and color classes for history badges
const keyDisplay = {
  'mouse0': { label: 'BA', css: 'badge-ba' },
  'heavy': { label: 'HA', css: 'badge-ha' },
  'mouse2': { label: 'Dodge', css: 'badge-dodge' },
  'q': { label: 'Echo', css: 'badge-echo' },
  'e': { label: 'SKL', css: 'badge-skl' },
  'r': { label: 'Lib', css: 'badge-lib' },
  'f': { label: 'TB', css: 'badge-tune' },
  'space': { label: 'Jump', css: 'badge-jump' },
  '1': { label: 'P1', css: 'badge-char' },
  '2': { label: 'P2', css: 'badge-char' },
  '3': { label: 'P3', css: 'badge-char' }
};

// keys that appear in the history (no WASD)
const historyKeys = ['mouse0', 'heavy', 'q', 'e', 'r', 'f', 'mouse2', 'space', '1', '2', '3'];

// mask to strip WASD from the history input
const movementMask = keyMapping['w'] | keyMapping['a'] | keyMapping['s'] | keyMapping['d'];

// ── WebSocket connection to input_server.py ──
// Captures global system inputs even when OBS browser source is not focused
const WS_URL = 'ws://localhost:8765';
let ws = null;

function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => console.log('[WS] Connected to input server');

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'state') {
        keysPressed = new Set(data.keys);
        mousePressed = new Set(data.mouse);
      }
    } catch (e) { }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected – retrying in 2s');
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = () => ws.close();
}

// ── Fallback: native browser events for local testing ──
window.addEventListener('keydown', (e) => {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  const key = e.key.toLowerCase();
  if (key === ' ') keysPressed.add('space');
  else if (keyMapping[key] !== undefined) keysPressed.add(key);
  if (key >= '1' && key <= '3') keysPressed.add(key);
});

window.addEventListener('keyup', (e) => {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  const key = e.key.toLowerCase();
  if (key === ' ') keysPressed.delete('space');
  else if (keyMapping[key] !== undefined) keysPressed.delete(key);
  if (key >= '1' && key <= '3') keysPressed.delete(key);
});

window.addEventListener('mousedown', (e) => {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  if (e.button === 0) mousePressed.add('mouse0');
  else if (e.button === 2) mousePressed.add('mouse2');
});

window.addEventListener('mouseup', (e) => {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  if (e.button === 0) mousePressed.delete('mouse0');
  else if (e.button === 2) mousePressed.delete('mouse2');
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

// ── build the DOM ──────────────────────────────────────────────
function init() {
  const container = document.createElement("div");
  container.setAttribute("id", "mainContainer");

  // ── overlay (WASD + mouse buttons) ──
  const overlayContainer = document.createElement("div");
  overlayContainer.setAttribute("id", "overlayContainer");

  // WASD grid
  const wasdOverlay = document.createElement("div");
  wasdOverlay.setAttribute("id", "wasdOverlay");

  const wasdLayout = [
    '', 'w', '',
    'a', 's', 'd',
    '', '', ''
  ];
  wasdLayout.forEach(key => {
    const cell = document.createElement("div");
    cell.setAttribute("class", "overlay-key");
    if (key) {
      cell.setAttribute("id", `overlay-${key}`);
      cell.textContent = key.toUpperCase();
    } else {
      cell.style.visibility = "hidden";
    }
    wasdOverlay.append(cell);
  });

  // mouse buttons row
  const mouseOverlay = document.createElement("div");
  mouseOverlay.setAttribute("id", "mouseOverlay");

  [{ id: 'mouse0', label: 'LMB' }, { id: 'mouse2', label: 'RMB' }].forEach(item => {
    const btn = document.createElement("div");
    btn.setAttribute("id", `overlay-${item.id}`);
    btn.setAttribute("class", "overlay-key mouse-btn");
    btn.textContent = item.label;
    mouseOverlay.append(btn);
  });

  overlayContainer.append(wasdOverlay);
  overlayContainer.append(mouseOverlay);

  // ── history column ──
  const lineContainer = document.createElement("div");
  lineContainer.setAttribute("id", "lineContainer");

  for (let i = 0; i < TOTAL_LINES; i++) {
    const line = document.createElement("div");
    line.setAttribute("id", `line-${i}`);
    line.setAttribute("class", "line");
    line.style.display = "none";

    const timer = document.createElement("span");
    timer.setAttribute("id", `timer-${i}`);
    timer.setAttribute("class", "timer");
    timer.textContent = "0";
    timer.style.color = "white";
    timer.style.display = "none";
    timer.style.position = "absolute";
    timer.style.left = "0";
    line.append(timer);

    historyKeys.forEach(key => {
      const info = keyDisplay[key];
      const badge = document.createElement("div");
      badge.setAttribute("id", `key-${key}-${i}`);
      badge.setAttribute("class", `key-icon ${info.css}`);
      badge.style.display = "none";
      badge.textContent = info.label;
      line.append(badge);
    });

    const countLabel = document.createElement("span");
    countLabel.setAttribute("id", `count-${i}`);
    countLabel.setAttribute("class", "press-count");
    countLabel.style.display = "none";
    line.append(countLabel);

    lineContainer.append(line);

    const sep = document.createElement("div");
    sep.setAttribute("class", "separator");
    sep.setAttribute("id", `separator-${i}`);
    sep.style.visibility = "hidden";
    lineContainer.append(sep);
  }

  container.append(overlayContainer);
  container.append(lineContainer);
  document.body.append(container);

  connectWebSocket();
  intervalId = setInterval(updateStatus, 1000 / 60);
}

// ── 60 fps update loop ────────────────────────────────────────
function updateStatus() {
  let expired = false;

  if (cycles < 500) cycles++;

  for (let i = inputAge.length - 1; i >= 0; i--) {
    inputAge[i]++;
    if (inputAge[i] >= EXPIRE_TIME) {
      expired = true;
      inputAge.pop();
      inputHistory.pop();
    }
  }

  // build full bitmask
  let inputNum = 0;
  keysPressed.forEach(k => { if (keyMapping[k] !== undefined) inputNum |= keyMapping[k]; });
  mousePressed.forEach(m => { if (keyMapping[m] !== undefined) inputNum |= keyMapping[m]; });

  // Heavy Attack detection: LMB held > 400ms
  if (mousePressed.has('mouse0')) {
    if (lmbHoldStart === 0) {
      lmbHoldStart = Date.now();
    } else if (Date.now() - lmbHoldStart >= HEAVY_ATTACK_THRESHOLD) {
      inputNum &= ~keyMapping['mouse0'];
      inputNum |= keyMapping['heavy'];
    }
  } else {
    lmbHoldStart = 0;
  }

  // strip movement keys – history only tracks actions
  const actionInput = inputNum & ~movementMask;

  if (currentInput !== actionInput || expired) {
    if (currentInput !== actionInput && actionInput !== 0) {
      // Check if we're alternating between two inputs
      let isAlternatingPattern = false;

      if (inputHistory.length >= 1) {
        const prev1 = inputHistory[0];

        // Check if prev1 is a combo pattern (has multiple bits set)
        const bitsSet = prev1.toString(2).split('1').length - 1;

        if (bitsSet === 2) {
          // Previous entry is a 2-button combo - only continue if it's an alternating combo
          const currentBits = actionInput.toString(2).split('1').length - 1;
          if ((actionInput & prev1) === actionInput && actionInput !== 0 && currentBits === 1 && isAlternatingCombo[0]) {
            // Current input is part of the alternating combo pattern, increment count
            pressCount[0]++;
            isAlternatingPattern = true;
          }
        } else if (inputHistory.length >= 2) {
          // Check for new alternating pattern
          const prev2 = inputHistory[1];

          // STRICT CHECK: Only create combo if:
          // 1. Pattern is A→B→A
          // 2. ALL entries are single presses (no spam)
          // 3. Each entry is a single button press (not simultaneous multi-button)
          // 4. No same input appears anywhere in recent history with spam count

          // Check that prev1 and prev2 are single-button presses
          const prev1Bits = prev1.toString(2).split('1').length - 1;
          const prev2Bits = prev2.toString(2).split('1').length - 1;
          const currentBits = actionInput.toString(2).split('1').length - 1;

          const isCleanAlternation =
            actionInput === prev2 &&
            prev1 !== prev2 &&
            pressCount[0] === 1 &&
            pressCount[1] === 1 &&
            prev1Bits === 1 &&
            prev2Bits === 1 &&
            currentBits === 1;

          // Additional check: make sure NEITHER input was spammed recently
          let hasRecentSpam = false;
          for (let i = 2; i < Math.min(inputHistory.length, 5); i++) {
            // Check if either the current input OR the other button in pattern was spammed
            if ((inputHistory[i] === actionInput || inputHistory[i] === prev1) && pressCount[i] > 1) {
              hasRecentSpam = true;
              break;
            }
          }

          if (isCleanAlternation && !hasRecentSpam) {
            // This is a true alternating pattern
            const combinedPattern = prev1 | prev2;

            // Replace the last two entries with the combo
            inputHistory.shift(); // Remove prev1
            inputHistory.shift(); // Remove prev2
            inputHistory.unshift(combinedPattern);

            pressCount.shift();
            pressCount.shift();
            pressCount.unshift(2); // Start with count of 2 (the two we just merged)

            isAlternatingCombo.shift();
            isAlternatingCombo.shift();
            isAlternatingCombo.unshift(true); // Mark as alternating combo

            cyclesHistory.shift();

            isAlternatingPattern = true;
          }
        }
      }

      if (!isAlternatingPattern) {
        // Normal single input handling
        // Check if this is a single-button press (not simultaneous multi-button)
        const currentBits = actionInput.toString(2).split('1').length - 1;
        const canMerge = currentBits === 1; // Only merge single button presses

        if (inputHistory.length === 0 || inputHistory[0] !== actionInput) {
          inputHistory.unshift(actionInput);
          inputAge.unshift(0);
          cyclesHistory.unshift(cycles);
          pressCount.unshift(1);
          isAlternatingCombo.unshift(false); // Not an alternating combo
          cycles = 1;
        } else if (canMerge) {
          // Same single button pressed again - increment count
          pressCount[0]++;
        } else {
          // Multi-button press - don't merge, create new entry
          inputHistory.unshift(actionInput);
          inputAge.unshift(0);
          cyclesHistory.unshift(cycles);
          pressCount.unshift(1);
          isAlternatingCombo.unshift(false); // Simultaneous press, not alternating
          cycles = 1;
        }
      }

      currentInput = actionInput;
    } else if (currentInput !== actionInput) {
      currentInput = actionInput;
    }

    while (inputHistory.length > TOTAL_LINES) inputHistory.pop();
    while (inputAge.length > TOTAL_LINES) inputAge.pop();
    while (cyclesHistory.length > TOTAL_LINES - 1) cyclesHistory.pop();
    while (pressCount.length > TOTAL_LINES) pressCount.pop();
    while (isAlternatingCombo.length > TOTAL_LINES) isAlternatingCombo.pop();

    const lines = document.getElementById('lineContainer').getElementsByClassName("line");
    const seps = document.getElementById('lineContainer').getElementsByClassName("separator");

    for (let i = 0; i < TOTAL_LINES; i++) {
      if (i >= inputHistory.length) {
        lines[i].style.display = "none";
        seps[i].style.visibility = "hidden";
        continue;
      }

      lines[i].style.display = "inline-block";
      seps[i].style.visibility = "visible";

      const input = inputHistory[i];
      const text = document.getElementById(`timer-${i}`);
      text.style.display = "inline-block";
      if (i > 0) text.textContent = cyclesHistory[i - 1];

      const countLabel = document.getElementById(`count-${i}`);
      const count = pressCount[i] || 1;
      if (count > 1) {
        countLabel.textContent = `x${count}`;
        countLabel.style.display = "inline-block";
      } else {
        countLabel.style.display = "none";
      }

      historyKeys.forEach(key => {
        document.getElementById(`key-${key}-${i}`).style.display =
          (input & keyMapping[key]) ? "inline-block" : "none";
      });
    }
  }

  const t0 = document.getElementById('timer-0');
  if (t0) t0.textContent = cycles;

  // ── update overlay colours ──
  ['w', 'a', 's', 'd', 'mouse0', 'mouse2'].forEach(key => {
    const el = document.getElementById(`overlay-${key}`);
    if (!el) return;
    const active = keysPressed.has(key) || mousePressed.has(key);
    el.classList.toggle('active', active);
  });
}

window.addEventListener('DOMContentLoaded', init);
