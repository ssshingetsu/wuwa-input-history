import asyncio
import json
import websockets
from pynput import keyboard, mouse

# Track currently pressed keys and mouse buttons
pressed_keys = set()
pressed_mouse = set()
connected_clients = set()

# Keys we care about
TRACKED_KEYS = {
    'w', 'a', 's', 'd',
    'q', 'e', 'r', 'f',
    '1', '2', '3'
}

SPECIAL_KEYS = {
    keyboard.Key.space: 'space',
}

def get_state():
    """Build the current input state as a JSON message."""
    return json.dumps({
        "type": "state",
        "keys": list(pressed_keys),
        "mouse": list(pressed_mouse)
    })

async def broadcast():
    """Send current state to all connected clients."""
    if connected_clients:
        msg = get_state()
        await asyncio.gather(
            *[client.send(msg) for client in connected_clients],
            return_exceptions=True
        )

async def handler(websocket):
    connected_clients.add(websocket)
    print(f"[+] Client connected ({len(connected_clients)} total)")
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        print(f"[-] Client disconnected ({len(connected_clients)} total)")

def on_key_press(key):
    changed = False
    try:
        k = key.char.lower()
        if k in TRACKED_KEYS and k not in pressed_keys:
            pressed_keys.add(k)
            changed = True
    except AttributeError:
        if key in SPECIAL_KEYS:
            name = SPECIAL_KEYS[key]
            if name not in pressed_keys:
                pressed_keys.add(name)
                changed = True
    if changed:
        asyncio.run_coroutine_threadsafe(broadcast(), loop)

def on_key_release(key):
    changed = False
    try:
        k = key.char.lower()
        if k in TRACKED_KEYS and k in pressed_keys:
            pressed_keys.discard(k)
            changed = True
    except AttributeError:
        if key in SPECIAL_KEYS:
            name = SPECIAL_KEYS[key]
            if name in pressed_keys:
                pressed_keys.discard(name)
                changed = True
    if changed:
        asyncio.run_coroutine_threadsafe(broadcast(), loop)

def on_mouse_click(x, y, button, is_pressed):
    changed = False
    if button == mouse.Button.left:
        name = 'mouse0'
    elif button == mouse.Button.right:
        name = 'mouse2'
    else:
        return

    if is_pressed and name not in pressed_mouse:
        pressed_mouse.add(name)
        changed = True
    elif not is_pressed and name in pressed_mouse:
        pressed_mouse.discard(name)
        changed = True

    if changed:
        asyncio.run_coroutine_threadsafe(broadcast(), loop)

async def main():
    global loop
    loop = asyncio.get_running_loop()

    # Start keyboard and mouse listeners (run in background threads)
    kb_listener = keyboard.Listener(on_press=on_key_press, on_release=on_key_release)
    ms_listener = mouse.Listener(on_click=on_mouse_click)
    kb_listener.start()
    ms_listener.start()

    print("Input server running on ws://localhost:8765")
    print("Press Ctrl+C to stop")

    async with websockets.serve(handler, "localhost", 8765):
        # Broadcast state at 60fps even when nothing changes (keeps overlay in sync)
        while True:
            await broadcast()
            await asyncio.sleep(1 / 60)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")
