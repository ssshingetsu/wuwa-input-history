# Wuthering Waves Input Tracker
Keyboard & mouse input tracker overlay for Wuthering Waves, designed as a browser source for OBS or other recording software.

## Features
- **WASD + Mouse Overlay** — real-time movement and mouse button display
- **Action Input History** — color-coded badges: BA, SKL, Echo, Lib, Tune, Dodge, Jump, Char1/2/3
- **No directional clutter** — WASD shown only in the overlay
- **Works in OBS** — uses a local WebSocket server to capture inputs globally (no focus needed)
- **Transparent background** — drops straight into any OBS scene

## Setup

### 1. Install Python dependencies
```
pip install -r requirements.txt
```

### 2. Run the input server
```
python input_server.py
```
Keep this running while you play. It captures global keyboard/mouse inputs.

### 3. Add to OBS
1. Add a **Browser Source** in OBS
2. Check **"Local file"** and select `index.html`
3. Recommended size: **500 x 1275**
4. Remove any auto-generated Custom CSS if it causes issues

The overlay will auto-connect to the input server and track your inputs even while the game is focused.

## Tracked Inputs
| Badge | Key | Color |
|-------|-----|-------|
| BA | Left Click | Red |
| SKL | Q | Blue |
| Echo | E | Pink |
| Lib | R | Gold |
| Tune | F | Cyan |
| Dodge | Right Click | Green |
| Jump | Space | Gray |
| Char1/2/3 | 1/2/3 | Yellow |

WASD is shown in the overlay only (not in history).

## Change entry expiration time
1. Open `code.js`
2. Edit the first line: `const EXPIRE_TIME = 1800;`
3. Value is in **frames** at 60 fps

| Frames | Duration |
|--------|----------|
| 60 | 1 s |
| 300 | 5 s |
| 600 | 10 s |
| 1800 | 30 s (default) |
| 3600 | 1 min |
