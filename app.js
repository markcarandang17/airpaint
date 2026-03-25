const videoEl = document.getElementById("inputVideo");
const outputCanvas = document.getElementById("outputCanvas");
const ctx = outputCanvas.getContext("2d");
const hudText = document.getElementById("hudText");
const gestureBadge = document.getElementById("gestureBadge");
const clearBtn = document.getElementById("clearBtn");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const replayBtn = document.getElementById("replayBtn");
const downloadBtn = document.getElementById("downloadBtn");
const sizeValue = document.getElementById("sizeValue");
const challengePromptEl = document.getElementById("challengePrompt");
const challengeTimerEl = document.getElementById("challengeTimer");
const challengeScoreEl = document.getElementById("challengeScore");
const challengeRoundEl = document.getElementById("challengeRound");
const startChallengeBtn = document.getElementById("startChallengeBtn");
const nextChallengeBtn = document.getElementById("nextChallengeBtn");
const brushModeButtons = Array.from(document.querySelectorAll("[data-brush-mode]"));
const backgroundButtons = Array.from(document.querySelectorAll("[data-bg-mode]"));

const drawLayer = document.createElement("canvas");
const drawCtx = drawLayer.getContext("2d");

const TOOLBAR_HEIGHT = 70;
const DEFAULT_BRUSH_SIZE = 10;
const MIN_BRUSH_SIZE = 4;
const MAX_BRUSH_SIZE = 36;
const ERASER_SIZE = 42;
const PINCH_DISTANCE_PX = 48;
const SHORTCUT_HOLD_MS = 900;
const SHORTCUT_COOLDOWN_MS = 1200;
const SELECTION_HOLD_MS = 320;
const SELECTION_COOLDOWN_MS = 450;
const CHALLENGE_DURATION_MS = 20000;

const COLORS = {
  Pink: "#ff4fc3",
  Blue: "#46a6ff",
  Green: "#23e48e",
  Red: "#ff5d6c",
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

function getBrushModeZones() {
  return [
    { x1: 24, x2: 130, y1: 86, y2: 126, value: "Neon", label: "Neon" },
    { x1: 140, x2: 276, y1: 86, y2: 126, value: "Rainbow", label: "Rainbow" },
    { x1: 286, x2: 410, y1: 86, y2: 126, value: "Sticker", label: "Sticker" }
  ];
}

function getBackgroundZones() {
  return [
    { x1: 24, x2: 140, y1: 138, y2: 178, value: "Camera", label: "Camera" },
    { x1: 150, x2: 306, y1: 138, y2: 178, value: "Chalkboard", label: "Chalkboard" },
    { x1: 316, x2: 470, y1: 138, y2: 178, value: "Neon Grid", label: "Neon Grid" },
    { x1: 480, x2: 594, y1: 138, y2: 178, value: "Galaxy", label: "Galaxy" }
  ];
}

function getActionZones(width) {
  return [
    { x1: width - 520, x2: width - 414, y1: 86, y2: 126, value: "Undo", label: "Undo" },
    { x1: width - 404, x2: width - 298, y1: 86, y2: 126, value: "Redo", label: "Redo" },
    { x1: width - 288, x2: width - 162, y1: 86, y2: 126, value: "Replay", label: "Replay" },
    {
      x1: width - 152,
      x2: width - 24,
      y1: 86,
      y2: 126,
      value: "Challenge",
      label: state.challenge.round === 0 ? "Start" : "Next"
    }
  ];
}

function isPointInZone(x, y, zone) {
  return x > zone.x1 && x < zone.x2 && y > zone.y1 && y < zone.y2;
}

function isPointInSelectionUi(x, y, width) {
  if (y <= TOOLBAR_HEIGHT) {
    return true;
  }

  const zones = [
    ...getBrushModeZones(),
    ...getBackgroundZones(),
    ...getActionZones(width)
  ];

  return zones.some((zone) => isPointInZone(x, y, zone));
}

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

const CHALLENGE_PROMPTS = [
  "Draw your dream job in 20 seconds.",
  "Sketch a robot that helps students.",
  "Create your favorite snack as a superhero.",
  "Draw a futuristic classroom gadget.",
  "Turn your school bag into a cool mascot.",
  "Sketch an animal wearing shades.",
  "Draw a concert poster using only one color.",
  "Create a spaceship shaped like a shoe.",
  "Draw the class adviser as a game character.",
  "Make a logo for your section."
];

const shortcutLabels = {
  clear: "Open palm clears",
  nextChallenge: "Rock sign next prompt"
};

const state = {
  currentTool: "Pink",
  currentBrushMode: "Neon",
  currentBackground: "Camera",
  brushSize: DEFAULT_BRUSH_SIZE,
  prevX: null,
  prevY: null,
  ready: false,
  cameraLabel: "Webcam",
  gestureText: "Waiting for hand...",
  selectionKey: "",
  selectionStartedAt: 0,
  lastSelectionAt: 0,
  shortcutKey: "",
  shortcutStartedAt: 0,
  lastShortcutAt: 0,
  strokes: [],
  redoStack: [],
  currentStroke: null,
  particles: [],
  replaying: false,
  replayToken: 0,
  lastFrameImage: null,
  challenge: {
    active: false,
    prompt: "Press Start Challenge to get a drawing mission for the class.",
    score: 0,
    round: 0,
    timeLeft: 0,
    endAt: 0
  }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(pointA, pointB) {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  return Math.sqrt((dx * dx) + (dy * dy));
}

function randomBetween(min, max) {
  return (Math.random() * (max - min)) + min;
}

function setCanvasSize(width, height) {
  if (outputCanvas.width === width && outputCanvas.height === height) {
    return;
  }

  outputCanvas.width = width;
  outputCanvas.height = height;

  const previousLayer = document.createElement("canvas");
  previousLayer.width = drawLayer.width || width;
  previousLayer.height = drawLayer.height || height;
  previousLayer.getContext("2d").drawImage(drawLayer, 0, 0);

  drawLayer.width = width;
  drawLayer.height = height;
  drawCtx.clearRect(0, 0, width, height);
  drawCtx.drawImage(previousLayer, 0, 0, width, height);
}

function setActiveButtons(buttons, value, attrName) {
  for (const button of buttons) {
    button.classList.toggle("active", button.dataset[attrName] === value);
  }
}

function updateBrushSizeLabel() {
  sizeValue.textContent = `${Math.round(state.brushSize)} px`;
}

function updateGestureBadge(text) {
  state.gestureText = text;
  gestureBadge.textContent = `Gesture: ${text}`;
}

function drawStatus() {
  const size = state.currentTool === "Eraser" ? ERASER_SIZE : Math.round(state.brushSize);
  const replayText = state.replaying ? " | Replay: ON" : "";
  const challengeText = state.challenge.round > 0
    ? ` | Challenge: ${state.challenge.timeLeft || "--"}s`
    : "";

  hudText.textContent = `${state.cameraLabel} | Tool: ${state.currentTool} | Brush: ${state.currentBrushMode} | Size: ${size}px | Theme: ${state.currentBackground}${challengeText}${replayText}`;
}

function resetPointerTrack() {
  state.prevX = null;
  state.prevY = null;
}

function resetShortcutTracking() {
  state.shortcutKey = "";
  state.shortcutStartedAt = 0;
}

function resetSelectionTracking() {
  state.selectionKey = "";
  state.selectionStartedAt = 0;
}

function cloneStroke(stroke) {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ ...point }))
  };
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
  return landmarks.map((point) => ({
    x: width - Math.floor(point.x * width),
    y: Math.floor(point.y * height)
  }));
}

function getShortcutGestureKey(fingers) {
  const allRaised = fingers.every((value) => value === 1);
  const rockSign = fingers[0] === 1 && fingers[1] === 1 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 1;

  if (allRaised) {
    return "clear";
  }

  if (thumbsUp) {
    return "save";
  }

  if (rockSign) {
    return "nextChallenge";
  }

  return "";
}

function drawCameraImage(targetCtx, image, width, height, alpha = 1) {
  if (!image) {
    targetCtx.fillStyle = "#050b12";
    targetCtx.fillRect(0, 0, width, height);
    return;
  }

  targetCtx.save();
  targetCtx.globalAlpha = alpha;
  targetCtx.translate(width, 0);
  targetCtx.scale(-1, 1);
  targetCtx.drawImage(image, 0, 0, width, height);
  targetCtx.restore();
}

function drawChalkboardBackdrop(targetCtx, width, height) {
  const gradient = targetCtx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#17342c");
  gradient.addColorStop(1, "#0e1f1a");
  targetCtx.fillStyle = gradient;
  targetCtx.fillRect(0, 0, width, height);

  for (let i = 0; i < 34; i += 1) {
    const x = (i / 33) * width;
    targetCtx.strokeStyle = "rgba(255,255,255,0.028)";
    targetCtx.beginPath();
    targetCtx.moveTo(x, 0);
    targetCtx.lineTo(x + Math.sin(i) * 18, height);
    targetCtx.stroke();
  }

  targetCtx.fillStyle = "rgba(240, 246, 255, 0.14)";
  targetCtx.font = `700 ${Math.max(26, width * 0.03)}px "Sora", sans-serif`;
  targetCtx.fillText("Imagine. Draw. Create.", 42, height - 40);
}

function drawNeonGridBackdrop(targetCtx, width, height) {
  const gradient = targetCtx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#05070f");
  gradient.addColorStop(1, "#101f36");
  targetCtx.fillStyle = gradient;
  targetCtx.fillRect(0, 0, width, height);

  targetCtx.fillStyle = "rgba(72, 177, 255, 0.08)";
  targetCtx.fillRect(0, height * 0.58, width, height * 0.42);

  const horizon = Math.floor(height * 0.58);
  targetCtx.strokeStyle = "rgba(83, 209, 255, 0.32)";
  targetCtx.lineWidth = 1;

  for (let x = 0; x <= width; x += 45) {
    targetCtx.beginPath();
    targetCtx.moveTo(x, horizon);
    targetCtx.lineTo(width / 2, height);
    targetCtx.stroke();
  }

  for (let i = 0; i < 12; i += 1) {
    const y = horizon + (i * 28);
    targetCtx.beginPath();
    targetCtx.moveTo(0, y);
    targetCtx.lineTo(width, y);
    targetCtx.stroke();
  }

  targetCtx.strokeStyle = "rgba(255, 110, 140, 0.55)";
  targetCtx.lineWidth = 3;
  targetCtx.beginPath();
  targetCtx.arc(width * 0.78, horizon - 40, 64, Math.PI, 0);
  targetCtx.stroke();
}

function drawGalaxyBackdrop(targetCtx, width, height) {
  const gradient = targetCtx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#07111f");
  gradient.addColorStop(0.55, "#0f2144");
  gradient.addColorStop(1, "#2a1330");
  targetCtx.fillStyle = gradient;
  targetCtx.fillRect(0, 0, width, height);

  for (let i = 0; i < 56; i += 1) {
    const x = ((Math.sin(i * 78.13) + 1) / 2) * width;
    const y = ((Math.cos(i * 43.77) + 1) / 2) * height;
    const radius = (i % 4) + 1;

    targetCtx.fillStyle = i % 5 === 0 ? "rgba(255, 200, 150, 0.82)" : "rgba(255, 255, 255, 0.82)";
    targetCtx.beginPath();
    targetCtx.arc(x, y, radius, 0, Math.PI * 2);
    targetCtx.fill();
  }

  targetCtx.fillStyle = "rgba(101, 208, 255, 0.14)";
  targetCtx.beginPath();
  targetCtx.arc(width * 0.72, height * 0.22, width * 0.12, 0, Math.PI * 2);
  targetCtx.fill();
}

function drawBackground(targetCtx, width, height, image) {
  if (state.currentBackground === "Camera") {
    drawCameraImage(targetCtx, image, width, height);
    return;
  }

  if (state.currentBackground === "Chalkboard") {
    drawChalkboardBackdrop(targetCtx, width, height);
  } else if (state.currentBackground === "Neon Grid") {
    drawNeonGridBackdrop(targetCtx, width, height);
  } else {
    drawGalaxyBackdrop(targetCtx, width, height);
  }
}

function drawToolbar() {
  ctx.fillStyle = "rgba(11, 16, 24, 0.86)";
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
    ctx.font = "700 13px Space Grotesk";
    ctx.fillText(button.label, button.x1 + 8, 40);

    if (state.currentTool === button.color) {
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 2;
      ctx.strokeRect(button.x1 - 3, 7, button.x2 - button.x1 + 6, 56);
    }
  }

  ctx.fillStyle = "rgba(232, 242, 255, 0.9)";
  ctx.font = "600 14px Space Grotesk";
  ctx.textAlign = "right";
  ctx.fillText(
    `Mode: ${state.currentBrushMode} | Size: ${state.currentTool === "Eraser" ? ERASER_SIZE : Math.round(state.brushSize)}px | BG: ${state.currentBackground}`,
    outputCanvas.width - 24,
    40
  );
  ctx.textAlign = "left";
}

function drawControlChip(zone, active, section) {
  const accent = section === "actions"
    ? "#ffd86d"
    : section === "backgrounds"
      ? "#66d6ff"
      : "#ff7fd0";

  ctx.fillStyle = active ? "rgba(255, 255, 255, 0.18)" : "rgba(7, 12, 19, 0.62)";
  ctx.strokeStyle = active ? accent : "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = active ? 3 : 1.5;
  ctx.beginPath();
  ctx.roundRect(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#eff7ff";
  ctx.font = "700 13px Space Grotesk";
  ctx.fillText(zone.label, zone.x1 + 12, zone.y1 + 25);
}

function drawGestureDock() {
  const brushZones = getBrushModeZones();
  const backgroundZones = getBackgroundZones();
  const actionZones = getActionZones(outputCanvas.width);

  ctx.fillStyle = "rgba(6, 11, 18, 0.58)";
  ctx.beginPath();
  ctx.roundRect(12, 78, 600, 112, 18);
  ctx.fill();

  ctx.fillStyle = "rgba(6, 11, 18, 0.58)";
  ctx.beginPath();
  ctx.roundRect(outputCanvas.width - 532, 78, 520, 60, 18);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "700 12px Space Grotesk";
  ctx.fillText("Brush Modes", 24, 80);
  ctx.fillText("Backgrounds", 24, 132);
  ctx.fillText("Gesture Actions", outputCanvas.width - 520, 80);

  for (const zone of brushZones) {
    drawControlChip(zone, state.currentBrushMode === zone.value, "brushes");
  }

  for (const zone of backgroundZones) {
    drawControlChip(zone, state.currentBackground === zone.value, "backgrounds");
  }

  for (const zone of actionZones) {
    drawControlChip(zone, false, "actions");
  }
}

function applyGestureSelection(x, y) {
  const target = getSelectionTarget(x, y, outputCanvas.width);
  return applySelectionTarget(target);
}

function applySelectionTarget(target) {
  if (!target) {
    return "";
  }

  if (target.type === "tool") {
    if (target.value === "Clear") {
      clearAllArtwork();
      return "Canvas cleared";
    }

    state.currentTool = target.value;
    return `Tool ${target.label}`;
  }

  if (target.type === "brush") {
    setBrushMode(target.value);
    return `Brush ${target.label}`;
  }

  if (target.type === "background") {
    setBackgroundMode(target.value);
    return `Theme ${target.label}`;
  }

  if (target.type === "action") {
    if (target.value === "Undo") {
      undoStroke();
      return "Undo";
    }

    if (target.value === "Redo") {
      redoStroke();
      return "Redo";
    }

    if (target.value === "Replay") {
      replayDrawing();
      return "Replay";
    }

    if (target.value === "Challenge") {
      if (state.challenge.round === 0) {
        startChallenge(true);
        return "Challenge started";
      }

      completeChallengeAndNext();
      return "Next challenge";
    }
  }

  return "";
}

function getSelectionTarget(x, y, width) {
  if (y <= TOOLBAR_HEIGHT) {
    for (const button of toolbarButtons) {
      if (x > button.x1 && x < button.x2 && y > 10 && y < 60) {
        return {
          key: `tool:${button.color}`,
          type: "tool",
          value: button.color,
          label: button.label
        };
      }
    }

    return null;
  }

  for (const zone of getBrushModeZones()) {
    if (isPointInZone(x, y, zone)) {
      return {
        key: `brush:${zone.value}`,
        type: "brush",
        value: zone.value,
        label: zone.label
      };
    }
  }

  for (const zone of getBackgroundZones()) {
    if (isPointInZone(x, y, zone)) {
      return {
        key: `background:${zone.value}`,
        type: "background",
        value: zone.value,
        label: zone.label
      };
    }
  }

  for (const zone of getActionZones(width)) {
    if (isPointInZone(x, y, zone)) {
      return {
        key: `action:${zone.value}`,
        type: "action",
        value: zone.value,
        label: zone.label
      };
    }
  }

  return null;
}

function handleSelectionGesture(target, now) {
  if (!target) {
    resetSelectionTracking();
    return "Selection mode";
  }

  if (now - state.lastSelectionAt < SELECTION_COOLDOWN_MS) {
    return `Hold ${target.label}`;
  }

  if (state.selectionKey !== target.key) {
    state.selectionKey = target.key;
    state.selectionStartedAt = now;
  }

  const progress = clamp((now - state.selectionStartedAt) / SELECTION_HOLD_MS, 0, 1);

  if (progress < 1) {
    return `Hold ${target.label} ${Math.round(progress * 100)}%`;
  }

  state.lastSelectionAt = now;
  resetSelectionTracking();
  return applySelectionTarget(target);
}

function getStrokeColor(stroke, segmentIndex) {
  if (stroke.tool === "Eraser") {
    return "rgba(0, 0, 0, 1)";
  }

  if (stroke.brushMode === "Rainbow") {
    const hue = (stroke.hueSeed + (segmentIndex * 14)) % 360;
    return `hsl(${hue}, 100%, 64%)`;
  }

  return COLORS[stroke.tool];
}

function drawGlowLine(targetCtx, stroke, fromPoint, toPoint, segmentIndex) {
  const color = getStrokeColor(stroke, segmentIndex);

  targetCtx.save();
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.lineWidth = stroke.size;

  if (stroke.tool === "Eraser") {
    targetCtx.globalCompositeOperation = "destination-out";
    targetCtx.strokeStyle = "rgba(0, 0, 0, 1)";
    targetCtx.shadowBlur = 0;
    targetCtx.shadowColor = "transparent";
  } else {
    targetCtx.globalCompositeOperation = "source-over";
    targetCtx.strokeStyle = color;
    targetCtx.shadowBlur = stroke.size * 1.6;
    targetCtx.shadowColor = color;
  }

  targetCtx.beginPath();
  targetCtx.moveTo(fromPoint.x, fromPoint.y);
  targetCtx.lineTo(toPoint.x, toPoint.y);
  targetCtx.stroke();

  if (stroke.tool !== "Eraser") {
    targetCtx.lineWidth = Math.max(2, stroke.size * 0.55);
    targetCtx.shadowBlur = stroke.size * 0.7;
    targetCtx.beginPath();
    targetCtx.moveTo(fromPoint.x, fromPoint.y);
    targetCtx.lineTo(toPoint.x, toPoint.y);
    targetCtx.stroke();
  }

  targetCtx.restore();
}

function drawDot(targetCtx, stroke, point, segmentIndex) {
  const color = getStrokeColor(stroke, segmentIndex);

  targetCtx.save();

  if (stroke.tool === "Eraser") {
    targetCtx.globalCompositeOperation = "destination-out";
    targetCtx.fillStyle = "rgba(0, 0, 0, 1)";
  } else {
    targetCtx.globalCompositeOperation = "source-over";
    targetCtx.fillStyle = color;
    targetCtx.shadowBlur = stroke.size * 1.4;
    targetCtx.shadowColor = color;
  }

  targetCtx.beginPath();
  targetCtx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.restore();
}

function drawStickerStamp(targetCtx, stroke, point, segmentIndex) {
  const outerRadius = stroke.size * 0.75;
  const innerRadius = outerRadius * 0.46;
  const spikes = 5;
  const color = getStrokeColor(stroke, segmentIndex);

  targetCtx.save();
  targetCtx.translate(point.x, point.y);
  targetCtx.fillStyle = color;
  targetCtx.shadowBlur = stroke.size * 1.5;
  targetCtx.shadowColor = color;
  targetCtx.beginPath();

  let rotation = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  targetCtx.moveTo(0, -outerRadius);

  for (let i = 0; i < spikes; i += 1) {
    targetCtx.lineTo(Math.cos(rotation) * outerRadius, Math.sin(rotation) * outerRadius);
    rotation += step;
    targetCtx.lineTo(Math.cos(rotation) * innerRadius, Math.sin(rotation) * innerRadius);
    rotation += step;
  }

  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.restore();
}

function spawnParticles(point, stroke, segmentIndex) {
  if (stroke.tool === "Eraser") {
    return;
  }

  const color = getStrokeColor(stroke, segmentIndex);
  const burstCount = stroke.brushMode === "Sticker" ? 7 : 4;

  for (let i = 0; i < burstCount; i += 1) {
    state.particles.push({
      x: point.x,
      y: point.y,
      vx: randomBetween(-1.4, 1.4),
      vy: randomBetween(-1.8, 0.4),
      radius: randomBetween(1.8, stroke.size * 0.3),
      life: randomBetween(14, 26),
      color
    });
  }
}

function updateAndDrawParticles() {
  const nextParticles = [];

  for (const particle of state.particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.03;
    particle.life -= 1;

    if (particle.life <= 0) {
      continue;
    }

    nextParticles.push(particle);

    ctx.save();
    ctx.globalAlpha = clamp(particle.life / 24, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  state.particles = nextParticles;
}

function renderStroke(targetCtx, stroke, emitParticles = false, maxPoints = stroke.points.length) {
  const points = stroke.points.slice(0, maxPoints);

  if (!points.length) {
    return;
  }

  if (stroke.brushMode === "Sticker") {
    for (let i = 0; i < points.length; i += 1) {
      drawStickerStamp(targetCtx, stroke, points[i], i);
      if (emitParticles) {
        spawnParticles(points[i], stroke, i);
      }
    }
    return;
  }

  if (points.length === 1) {
    drawDot(targetCtx, stroke, points[0], 0);
    if (emitParticles) {
      spawnParticles(points[0], stroke, 0);
    }
    return;
  }

  for (let i = 1; i < points.length; i += 1) {
    drawGlowLine(targetCtx, stroke, points[i - 1], points[i], i - 1);
    if (emitParticles) {
      const midpoint = {
        x: (points[i - 1].x + points[i].x) / 2,
        y: (points[i - 1].y + points[i].y) / 2
      };
      spawnParticles(midpoint, stroke, i - 1);
    }
  }
}

function redrawFromHistory() {
  drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);

  for (const stroke of state.strokes) {
    renderStroke(drawCtx, stroke, false);
  }
}

function beginStroke(point) {
  state.currentStroke = {
    tool: state.currentTool,
    brushMode: state.currentBrushMode,
    size: state.currentTool === "Eraser" ? ERASER_SIZE : state.brushSize,
    hueSeed: Math.floor(performance.now() / 4) % 360,
    points: [{ x: point.x, y: point.y }]
  };
  state.redoStack = [];

  if (state.currentBrushMode === "Sticker") {
    renderStroke(drawCtx, state.currentStroke, true);
  }
}

function extendStroke(point) {
  if (!state.currentStroke) {
    beginStroke(point);
    return;
  }

  const points = state.currentStroke.points;
  const lastPoint = points[points.length - 1];

  if (distance(lastPoint, point) < 2) {
    return;
  }

  points.push({ x: point.x, y: point.y });

  if (state.currentStroke.brushMode === "Sticker") {
    drawStickerStamp(drawCtx, state.currentStroke, point, points.length - 1);
    spawnParticles(point, state.currentStroke, points.length - 1);
    return;
  }

  drawGlowLine(drawCtx, state.currentStroke, lastPoint, point, points.length - 2);
  spawnParticles(point, state.currentStroke, points.length - 2);
}

function endStroke() {
  if (!state.currentStroke) {
    return;
  }

  const finishedStroke = cloneStroke(state.currentStroke);
  state.currentStroke = null;
  state.strokes.push(finishedStroke);
}

function clearAllArtwork() {
  state.strokes = [];
  state.redoStack = [];
  state.currentStroke = null;
  state.particles = [];
  drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
  resetPointerTrack();
  drawStatus();
}

function undoStroke() {
  endStroke();

  if (!state.strokes.length) {
    return;
  }

  state.redoStack.push(state.strokes.pop());
  redrawFromHistory();
}

function redoStroke() {
  endStroke();

  if (!state.redoStack.length) {
    return;
  }

  state.strokes.push(state.redoStack.pop());
  redrawFromHistory();
}

function drawHandMesh(points) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;

  for (const [fromIndex, toIndex] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(points[fromIndex].x, points[fromIndex].y);
    ctx.lineTo(points[toIndex].x, points[toIndex].y);
    ctx.stroke();
  }

  for (let i = 0; i < points.length; i += 1) {
    ctx.fillStyle = i === 8 ? "#fff07c" : "rgba(255, 255, 255, 0.78)";
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, i === 8 ? 6 : 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPointer(x, y) {
  const radius = state.currentTool === "Eraser" ? ERASER_SIZE / 2 : clamp(state.brushSize, 10, 22);
  const fill = state.currentTool === "Eraser"
    ? "#ffffff"
    : state.currentBrushMode === "Rainbow"
      ? `hsl(${Math.floor(performance.now() / 6) % 360}, 100%, 64%)`
      : COLORS[state.currentTool];

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.92;
  ctx.shadowBlur = 18;
  ctx.shadowColor = fill;
  ctx.fill();
  ctx.restore();
}

function setBrushMode(mode) {
  state.currentBrushMode = mode;
  setActiveButtons(brushModeButtons, mode, "brushMode");
  drawStatus();
}

function setBackgroundMode(mode) {
  state.currentBackground = mode;
  setActiveButtons(backgroundButtons, mode, "bgMode");
  drawStatus();
}

function pickNextPrompt() {
  const availablePrompts = CHALLENGE_PROMPTS.filter((prompt) => prompt !== state.challenge.prompt);
  const promptPool = availablePrompts.length ? availablePrompts : CHALLENGE_PROMPTS;
  return promptPool[Math.floor(Math.random() * promptPool.length)];
}

function renderChallengeUi() {
  challengePromptEl.textContent = state.challenge.prompt;
  challengeScoreEl.textContent = String(state.challenge.score);
  challengeRoundEl.textContent = String(state.challenge.round);
  challengeTimerEl.textContent = state.challenge.active ? `${state.challenge.timeLeft}s` : "--";
}

function startChallenge(resetScore = false) {
  if (resetScore) {
    state.challenge.score = 0;
    state.challenge.round = 0;
  }

  state.challenge.round += 1;
  state.challenge.active = true;
  state.challenge.timeLeft = Math.ceil(CHALLENGE_DURATION_MS / 1000);
  state.challenge.endAt = performance.now() + CHALLENGE_DURATION_MS;
  state.challenge.prompt = pickNextPrompt();
  renderChallengeUi();
  drawStatus();
}

function completeChallengeAndNext() {
  if (state.challenge.active) {
    state.challenge.score += 1;
  }

  startChallenge(false);
}

function updateChallengeTimer(now) {
  if (!state.challenge.active) {
    return;
  }

  const remainingMs = state.challenge.endAt - now;

  if (remainingMs <= 0) {
    state.challenge.active = false;
    state.challenge.timeLeft = 0;
    state.challenge.prompt = "Time is up. Hit Complete + Next or use the rock sign to launch another prompt.";
    renderChallengeUi();
    drawStatus();
    return;
  }

  const nextTime = Math.ceil(remainingMs / 1000);
  if (nextTime !== state.challenge.timeLeft) {
    state.challenge.timeLeft = nextTime;
    renderChallengeUi();
    drawStatus();
  }
}

function buildExportCanvas() {
  const merged = document.createElement("canvas");
  merged.width = outputCanvas.width;
  merged.height = outputCanvas.height;
  const mergedCtx = merged.getContext("2d");

  drawBackground(mergedCtx, merged.width, merged.height, state.lastFrameImage);
  mergedCtx.drawImage(drawLayer, 0, 0);
  return merged;
}

function downloadCurrentFrame() {
  const merged = buildExportCanvas();
  const link = document.createElement("a");
  link.download = "air-paint-wow.png";
  link.href = merged.toDataURL("image/png");
  link.click();
}

function applyShortcut(shortcutKey) {
  if (shortcutKey === "clear") {
    clearAllArtwork();
    updateGestureBadge("Canvas cleared");
    return;
  }

  if (shortcutKey === "nextChallenge") {
    if (state.challenge.round === 0) {
      startChallenge(true);
    } else {
      completeChallengeAndNext();
    }
    updateGestureBadge("New challenge launched");
  }
}

function handleShortcutGesture(shortcutKey, now) {
  if (!shortcutKey) {
    resetShortcutTracking();
    return false;
  }

  if (state.shortcutKey !== shortcutKey) {
    state.shortcutKey = shortcutKey;
    state.shortcutStartedAt = now;
  }

  const elapsed = now - state.shortcutStartedAt;
  const progress = clamp(elapsed / SHORTCUT_HOLD_MS, 0, 1);
  updateGestureBadge(`${shortcutLabels[shortcutKey]} ${Math.round(progress * 100)}%`);

  if (elapsed >= SHORTCUT_HOLD_MS && now - state.lastShortcutAt > SHORTCUT_COOLDOWN_MS) {
    state.lastShortcutAt = now;
    applyShortcut(shortcutKey);
    resetShortcutTracking();
  }

  return true;
}

function waitForAnimationFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

async function replayDrawing() {
  endStroke();

  if (!state.strokes.length || state.replaying) {
    return;
  }

  state.replaying = true;
  state.replayToken += 1;
  const token = state.replayToken;
  drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
  state.particles = [];
  drawStatus();
  updateGestureBadge("Replay mode");

  for (const stroke of state.strokes) {
    if (token !== state.replayToken) {
      break;
    }

    if (stroke.brushMode === "Sticker") {
      for (let i = 0; i < stroke.points.length; i += 1) {
        if (token !== state.replayToken) {
          break;
        }

        drawStickerStamp(drawCtx, stroke, stroke.points[i], i);
        spawnParticles(stroke.points[i], stroke, i);
        await waitForAnimationFrame();
      }
      continue;
    }

    if (stroke.points.length === 1) {
      drawDot(drawCtx, stroke, stroke.points[0], 0);
      await waitForAnimationFrame();
      continue;
    }

    for (let i = 1; i < stroke.points.length; i += 1) {
      if (token !== state.replayToken) {
        break;
      }

      drawGlowLine(drawCtx, stroke, stroke.points[i - 1], stroke.points[i], i - 1);
      spawnParticles(stroke.points[i], stroke, i - 1);

      if (i % 2 === 0) {
        await waitForAnimationFrame();
      }
    }
  }

  redrawFromHistory();
  state.replaying = false;
  drawStatus();
}

function renderFrame(results) {
  const now = performance.now();
  const width = results.image.width;
  const height = results.image.height;
  state.lastFrameImage = results.image;

  updateChallengeTimer(now);
  setCanvasSize(width, height);

  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height, results.image);
  ctx.drawImage(drawLayer, 0, 0);
  updateAndDrawParticles();
  drawToolbar();
  drawGestureDock();

  if (state.replaying) {
    updateGestureBadge("Replay mode");
    drawStatus();
    return;
  }

  const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  if (!hasHand) {
    endStroke();
    resetPointerTrack();
    resetSelectionTracking();
    resetShortcutTracking();
    updateGestureBadge("Show your hand to start");
    drawStatus();
    return;
  }

  const landmarks = results.multiHandLandmarks[0];
  const handedness = results.multiHandedness && results.multiHandedness[0]
    ? results.multiHandedness[0].label
    : "Right";

  const points = toDisplayCoords(landmarks, width, height);
  const fingers = getFingerStates(landmarks, handedness);
  const indexTip = points[8];
  const middleTip = points[12];
  const thumbTip = points[4];
  const pinchDistance = distance(thumbTip, indexTip);

  drawHandMesh(points);

  const shortcutKey = getShortcutGestureKey(fingers);
  const pinchGesture =
    fingers[0] === 1 &&
    fingers[1] === 1 &&
    fingers[2] === 0 &&
    fingers[3] === 0 &&
    fingers[4] === 0 &&
    pinchDistance < PINCH_DISTANCE_PX;
  const overSelectionUi = isPointInSelectionUi(indexTip.x, indexTip.y, width);
  const selectionTarget = fingers[1] === 1 && fingers[2] === 1
    ? getSelectionTarget(indexTip.x, indexTip.y, width)
    : null;
  const selectionGesture =
    fingers[1] === 1 &&
    fingers[2] === 1 &&
    overSelectionUi;
  const drawingGesture = fingers[1] === 1 && !pinchGesture && !overSelectionUi;

  if (shortcutKey) {
    endStroke();
    resetPointerTrack();
    resetSelectionTracking();
    handleShortcutGesture(shortcutKey, now);
    drawPointer(indexTip.x, indexTip.y);
    drawStatus();
    return;
  }

  resetShortcutTracking();

  if (pinchGesture) {
    endStroke();
    resetPointerTrack();
    resetSelectionTracking();

    state.brushSize = clamp(pinchDistance * 0.26, MIN_BRUSH_SIZE, MAX_BRUSH_SIZE);
    updateBrushSizeLabel();
    updateGestureBadge(`Pinch size ${Math.round(state.brushSize)}px`);

    ctx.strokeStyle = "rgba(255, 238, 133, 0.92)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(thumbTip.x, thumbTip.y);
    ctx.lineTo(indexTip.x, indexTip.y);
    ctx.stroke();

    drawPointer(indexTip.x, indexTip.y);
    drawStatus();
    return;
  }

  if (selectionGesture) {
    endStroke();
    resetPointerTrack();
    const selectionResult = handleSelectionGesture(selectionTarget, now);
    updateGestureBadge(selectionResult || "Selection mode");

    ctx.strokeStyle = state.currentTool === "Eraser" ? "#ffffff" : COLORS[state.currentTool];
    ctx.lineWidth = 3;
    ctx.strokeRect(indexTip.x, indexTip.y - 22, middleTip.x - indexTip.x, middleTip.y - indexTip.y + 44);
    drawPointer(indexTip.x, indexTip.y);
    drawStatus();
    return;
  }

  if (drawingGesture) {
    resetSelectionTracking();
    updateGestureBadge(`${state.currentBrushMode} drawing`);
    drawPointer(indexTip.x, indexTip.y);

    if (state.prevX === null || state.prevY === null) {
      state.prevX = indexTip.x;
      state.prevY = indexTip.y;
      beginStroke(indexTip);
    }

    const smoothPoint = {
      x: Math.floor((indexTip.x + state.prevX) / 2),
      y: Math.floor((indexTip.y + state.prevY) / 2)
    };

    extendStroke(smoothPoint);

    state.prevX = smoothPoint.x;
    state.prevY = smoothPoint.y;
    drawStatus();
    return;
  }

  endStroke();
  resetPointerTrack();
  resetSelectionTracking();
  updateGestureBadge("Gesture idle");
  drawStatus();
}

brushModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setBrushMode(button.dataset.brushMode);
  });
});

backgroundButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setBackgroundMode(button.dataset.bgMode);
  });
});

clearBtn.addEventListener("click", () => {
  clearAllArtwork();
});

undoBtn.addEventListener("click", () => {
  undoStroke();
});

redoBtn.addEventListener("click", () => {
  redoStroke();
});

replayBtn.addEventListener("click", () => {
  replayDrawing();
});

downloadBtn.addEventListener("click", () => {
  downloadCurrentFrame();
});

startChallengeBtn.addEventListener("click", () => {
  startChallenge(true);
});

nextChallengeBtn.addEventListener("click", () => {
  if (state.challenge.round === 0) {
    startChallenge(true);
  } else {
    completeChallengeAndNext();
  }
});

updateBrushSizeLabel();
renderChallengeUi();
drawStatus();

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
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
    updateGestureBadge("Show your hand to start");
    drawStatus();
  })
  .catch((error) => {
    hudText.textContent = `Camera permission error: ${error.message}`;
    updateGestureBadge("Camera unavailable");
  });
