# Air Paint Web App

This converts the camera-drawing concept from `draw.py` into a browser UI.

## Features

- Live webcam preview in browser with hand landmark overlay
- Hand tracking with MediaPipe Hands
- Upgraded brush modes:
  - Neon brush
  - Rainbow brush
  - Sticker/star stamp brush
- Particle trail effects while drawing
- Pinch gesture to resize the brush live
- Gesture shortcuts:
  - Index + middle finger up: select tool in the top toolbar
  - Index finger up only: draw
  - Open palm: hold to clear canvas
  - Thumbs up: hold to save PNG
  - Rock sign: hold to launch the next challenge prompt
- Tools: Pink, Blue, Green, Red, Eraser, Clear
- Undo, redo, replay/timelapse, and PNG download
- Background themes: Camera, Chalkboard, Neon Grid, Galaxy
- Challenge mode with timed prompts, score, and rounds
- Full gesture-first control deck on the canvas, so the demo can run without using a mouse

## Run

Because browsers require a local server for webcam + JS modules, run one of these from this folder:

### Option 1: Python

```bash
python -m http.server 8000
```

Then open:

- http://localhost:8000

### Option 2: VS Code Live Server extension

Open `index.html` and click "Go Live".

## Notes

- First launch will ask for camera permission.
- Performance depends on webcam resolution and device speed.
- Original desktop script remains available in `draw.py`.
- For the strongest presentation demo, start with `Rainbow` or `Sticker`, switch to `Neon Grid` or `Galaxy`, then launch `Challenge Mode`.
