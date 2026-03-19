const videoEl = document.getElementById("inputVideo");
const outputCanvas = document.getElementById("outputCanvas");
const ctx = outputCanvas.getContext("2d");
const hudText = document.getElementById("hudText");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

const drawLayer = document.createElement("canvas");
const drawCtx = drawLayer.getContext("2d");

const TOOLBAR_HEIGHT = 70;
const BRUSH_SIZE = 8;
const ERASER_SIZE = 40;

const COLORS = {
  Pink: "#ff00ff",
  Blue: "#0075ff",
  Green: "#00d767",
  Red: "#ff2f5c",
  Eraser: "eraser"
};

const toolbarButtons = [
  { x1: 20, x2: 90, color: "Pink", label: "Pink" },
  { x1: 110, x2: 180, color: "Blue", label: "Blue" },
  { x1: 200, x2: 270, color: "Green", label: "Green" },
  { x1: 290, x2: 360, color: "Red", label: "Red" },
  { x1: 380, x2: 470, color: "Eraser", label: "Eraser" },
  { x1: 490, x2: 620, color: "Clear", label: "Clear" }
];

const state = {
  currentTool: "Pink",
  prevX: null,
  prevY: null,
  ready: false,
  cameraLabel: "Webcam"
};

function setCanvasSize(width, height) {
  if (outputCanvas.width === width && outputCanvas.height === height) {
    return;
  }

  outputCanvas.width = width;
  outputCanvas.height = height;

  const prevLayer = document.createElement("canvas");
  prevLayer.width = drawLayer.width || width;
  prevLayer.height = drawLayer.height || height;
  prevLayer.getContext("2d").drawImage(drawLayer, 0, 0);

  drawLayer.width = width;
  drawLayer.height = height;
  drawCtx.clearRect(0, 0, width, height);
  drawCtx.drawImage(prevLayer, 0, 0, width, height);
}

function clearDrawing() {
  drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
  state.prevX = null;
  state.prevY = null;
}

function getFingerStates(landmarks, handednessLabel) {
  const tips = [4, 8, 12, 16, 20];
  const fingers = [0, 0, 0, 0, 0];

  if (handednessLabel === "Right") {
    fingers[0] = landmarks[tips[0]].x < landmarks[tips[0] - 1].x ? 1 : 0;
  } else {
    fingers[0] = landmarks[tips[0]].x > landmarks[tips[0] - 1].x ? 1 : 0;
  }

  for (let i = 1; i < 5; i += 1) {
    fingers[i] = landmarks[tips[i]].y < landmarks[tips[i] - 2].y ? 1 : 0;
  }

  return fingers;
}

function toDisplayCoords(landmarks, width, height) {
  return landmarks.map((point) => {
    return {
      x: width - Math.floor(point.x * width),
      y: Math.floor(point.y * height)
    };
  });
}

function drawToolbar() {
  ctx.fillStyle = "rgba(40, 40, 40, 0.88)";
  ctx.fillRect(0, 0, outputCanvas.width, TOOLBAR_HEIGHT);

  for (const button of toolbarButtons) {
    const isClear = button.color === "Clear";
    const isEraser = button.color === "Eraser";
    const swatch = isClear ? "#ffffff" : isEraser ? "#111111" : COLORS[button.color];

    ctx.fillStyle = swatch;
    ctx.fillRect(button.x1, 10, button.x2 - button.x1, 50);
    ctx.strokeStyle = isClear ? "#111111" : "#f4f8ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(button.x1, 10, button.x2 - button.x1, 50);

    ctx.fillStyle = isClear ? "#111111" : "#ffffff";
    ctx.font = "13px Space Grotesk";
    ctx.fillText(button.label, button.x1 + 8, 40);

    if (state.currentTool === button.color) {
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 2;
      ctx.strokeRect(button.x1 - 3, 7, button.x2 - button.x1 + 6, 56);
    }
  }
}

function drawStatus() {
  const toolName = state.currentTool;
  const text = `${state.cameraLabel} | Tool: ${toolName} | Gesture: index+middle=select, index=draw`;
  hudText.textContent = text;
}

function applyToolbarSelection(x, y) {
  if (y > TOOLBAR_HEIGHT) {
    return;
  }

  for (const button of toolbarButtons) {
    if (x > button.x1 && x < button.x2 && y > 10 && y < 60) {
      if (button.color === "Clear") {
        clearDrawing();
      } else {
        state.currentTool = button.color;
      }
      break;
    }
  }
}

function drawStroke(fromX, fromY, toX, toY) {
  const isEraser = state.currentTool === "Eraser";
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";
  drawCtx.lineWidth = isEraser ? ERASER_SIZE : BRUSH_SIZE;

  if (isEraser) {
    drawCtx.globalCompositeOperation = "destination-out";
    drawCtx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.strokeStyle = COLORS[state.currentTool];
  }

  drawCtx.beginPath();
  drawCtx.moveTo(fromX, fromY);
  drawCtx.lineTo(toX, toY);
  drawCtx.stroke();
}

function drawPointer(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fillStyle = state.currentTool === "Eraser" ? "#ffffff" : COLORS[state.currentTool];
  ctx.fill();
}

function renderFrame(results) {
  const width = results.image.width;
  const height = results.image.height;
  setCanvasSize(width, height);

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(results.image, 0, 0, width, height);
  ctx.restore();

  ctx.drawImage(drawLayer, 0, 0);
  drawToolbar();

  const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  if (!hasHand) {
    state.prevX = null;
    state.prevY = null;
    drawStatus();
    return;
  }

  const landmarks = results.multiHandLandmarks[0];
  const handedness = results.multiHandedness && results.multiHandedness[0]
    ? results.multiHandedness[0].label
    : "Right";

  const points = toDisplayCoords(landmarks, width, height);
  const indexTip = points[8];
  const middleTip = points[12];
  const fingers = getFingerStates(landmarks, handedness);

  if (fingers[1] === 1 && fingers[2] === 1) {
    state.prevX = null;
    state.prevY = null;
    applyToolbarSelection(indexTip.x, indexTip.y);

    ctx.strokeStyle = state.currentTool === "Eraser" ? "#ffffff" : COLORS[state.currentTool];
    ctx.lineWidth = 2;
    ctx.strokeRect(indexTip.x, indexTip.y - 20, middleTip.x - indexTip.x, middleTip.y - indexTip.y + 40);

    drawPointer(indexTip.x, indexTip.y);
  } else if (fingers[1] === 1 && fingers[2] === 0) {
    drawPointer(indexTip.x, indexTip.y);

    if (state.prevX === null || state.prevY === null) {
      state.prevX = indexTip.x;
      state.prevY = indexTip.y;
    }

    const smoothX = Math.floor((indexTip.x + state.prevX) / 2);
    const smoothY = Math.floor((indexTip.y + state.prevY) / 2);

    drawStroke(state.prevX, state.prevY, smoothX, smoothY);

    state.prevX = smoothX;
    state.prevY = smoothY;
  } else {
    state.prevX = null;
    state.prevY = null;
  }

  drawStatus();
}

const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults((results) => {
  renderFrame(results);
  if (!state.ready) {
    state.ready = true;
  }
});

const camera = new Camera(videoEl, {
  onFrame: async () => {
    await hands.send({ image: videoEl });
  },
  width: 1280,
  height: 720
});

camera.start()
  .then(() => {
    hudText.textContent = "Camera active. Move your hand into frame to start drawing.";
    drawStatus();
  })
  .catch((error) => {
    hudText.textContent = `Camera permission error: ${error.message}`;
  });

clearBtn.addEventListener("click", () => {
  clearDrawing();
});

downloadBtn.addEventListener("click", () => {
  const merged = document.createElement("canvas");
  merged.width = outputCanvas.width;
  merged.height = outputCanvas.height;
  const mergedCtx = merged.getContext("2d");

  mergedCtx.drawImage(outputCanvas, 0, 0);
  const link = document.createElement("a");
  link.download = "air-paint.png";
  link.href = merged.toDataURL("image/png");
  link.click();
});
