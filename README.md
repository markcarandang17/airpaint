# Air Paint Web App

This converts the camera-drawing concept from `draw.py` into a browser UI.

## Features

- Live webcam preview in browser
- Hand tracking with MediaPipe Hands
- Gesture controls:
  - Index + middle finger up: select tool in top toolbar
  - Index finger up only: draw
- Tools: Pink, Blue, Green, Red, Eraser, Clear
- Clear canvas button and PNG download button

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
