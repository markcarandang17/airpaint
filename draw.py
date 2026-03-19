import cv2
import mediapipe as mp
import numpy as np

# -----------------------------
# Camera selection
# -----------------------------
def open_camera():
    """
    Try to open NVIDIA Broadcast / virtual camera first,
    then fall back to normal webcam indexes.
    """
    candidates = [
        (1, cv2.CAP_DSHOW),
        (0, cv2.CAP_DSHOW),
        (2, cv2.CAP_DSHOW),
        (3, cv2.CAP_DSHOW),
        (1, cv2.CAP_MSMF),
        (0, cv2.CAP_MSMF),
        (2, cv2.CAP_MSMF),
        (3, cv2.CAP_MSMF),
    ]

    for index, backend in candidates:
        cap = cv2.VideoCapture(index, backend)
        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                backend_name = "CAP_DSHOW" if backend == cv2.CAP_DSHOW else "CAP_MSMF"
                print(f"[INFO] Using camera index {index} with {backend_name}")
                return cap, index, backend_name
            cap.release()

    return None, None, None


# -----------------------------
# MediaPipe hand setup
# -----------------------------
mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)

# -----------------------------
# Open camera
# -----------------------------
cap, cam_index, cam_backend = open_camera()

if cap is None:
    print("Cannot open any camera.")
    exit()

# Optional: set resolution
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

# Read one frame first to get size
ret, frame = cap.read()
if not ret or frame is None:
    print("Cannot read first frame from camera.")
    cap.release()
    exit()

frame = cv2.flip(frame, 1)
h, w, c = frame.shape

# Transparent drawing canvas
canvas = np.zeros((h, w, 3), dtype=np.uint8)

# Drawing settings
draw_color = (255, 0, 255)   # pink in BGR
brush_thickness = 8
eraser_thickness = 40

xp, yp = 0, 0  # previous point


# -----------------------------
# Helper functions
# -----------------------------
def fingers_up(hand_landmarks):
    """
    Return list of 5 fingers state:
    [thumb, index, middle, ring, pinky]
    1 = up, 0 = down
    """
    tips = [4, 8, 12, 16, 20]
    lm = hand_landmarks.landmark
    fingers = []

    # Thumb
    if lm[tips[0]].x < lm[tips[0] - 1].x:
        fingers.append(1)
    else:
        fingers.append(0)

    # Other 4 fingers
    for i in range(1, 5):
        if lm[tips[i]].y < lm[tips[i] - 2].y:
            fingers.append(1)
        else:
            fingers.append(0)

    return fingers


def draw_toolbar(img, current_color):
    """
    Draw top toolbar for color selection.
    """
    cv2.rectangle(img, (0, 0), (w, 70), (40, 40, 40), -1)

    colors = [
        ((20, 10), (90, 60), (255, 0, 255), "Pink"),
        ((110, 10), (180, 60), (255, 0, 0), "Blue"),
        ((200, 10), (270, 60), (0, 255, 0), "Green"),
        ((290, 10), (360, 60), (0, 0, 255), "Red"),
        ((380, 10), (470, 60), (0, 0, 0), "Eraser"),
        ((490, 10), (620, 60), (255, 255, 255), "Clear"),
    ]

    for (x1, y1), (x2, y2), color, label in colors:
        border_color = (255, 255, 255) if color != (255, 255, 255) else (0, 0, 0)
        cv2.rectangle(img, (x1, y1), (x2, y2), color, -1)
        cv2.rectangle(img, (x1, y1), (x2, y2), border_color, 2)

        text_color = (255, 255, 255) if sum(color) < 100 else (0, 0, 0)
        cv2.putText(
            img, label, (x1 + 5, y2 - 10),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, text_color, 1
        )

        # Highlight selected color except Clear
        if color == current_color and label != "Clear":
            cv2.rectangle(img, (x1 - 3, y1 - 3), (x2 + 3, y2 + 3), (0, 255, 255), 2)


def draw_status(img, cam_index, cam_backend, current_color):
    """
    Show camera/backend and current tool.
    """
    color_name = "Pink"
    if current_color == (255, 0, 0):
        color_name = "Blue"
    elif current_color == (0, 255, 0):
        color_name = "Green"
    elif current_color == (0, 0, 255):
        color_name = "Red"
    elif current_color == (0, 0, 0):
        color_name = "Eraser"

    status_text = f"Camera: {cam_index} ({cam_backend}) | Tool: {color_name} | ESC: Exit"
    cv2.putText(
        img, status_text, (10, h - 15),
        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2
    )


# -----------------------------
# Main loop
# -----------------------------
while True:
    ret, frame = cap.read()
    if not ret or frame is None:
        print("Failed to read frame.")
        break

    frame = cv2.flip(frame, 1)
    display = frame.copy()

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb)

    # Draw toolbar
    draw_toolbar(display, draw_color)

    if results.multi_hand_landmarks:
        handLms = results.multi_hand_landmarks[0]
        mp_draw.draw_landmarks(display, handLms, mp_hands.HAND_CONNECTIONS)

        lm_list = []
        for idx, lm in enumerate(handLms.landmark):
            cx, cy = int(lm.x * w), int(lm.y * h)
            lm_list.append((idx, cx, cy))

        if lm_list:
            x1, y1 = lm_list[8][1], lm_list[8][2]    # index tip
            x2, y2 = lm_list[12][1], lm_list[12][2]  # middle tip

            fingers = fingers_up(handLms)

            # Selection mode: index + middle finger up
            if fingers[1] == 1 and fingers[2] == 1:
                xp, yp = 0, 0
                cv2.circle(display, (x1, y1), 12, draw_color, -1)

                if y1 < 70:
                    if 20 < x1 < 90:
                        draw_color = (255, 0, 255)
                    elif 110 < x1 < 180:
                        draw_color = (255, 0, 0)
                    elif 200 < x1 < 270:
                        draw_color = (0, 255, 0)
                    elif 290 < x1 < 360:
                        draw_color = (0, 0, 255)
                    elif 380 < x1 < 470:
                        draw_color = (0, 0, 0)
                    elif 490 < x1 < 620:
                        canvas = np.zeros((h, w, 3), dtype=np.uint8)

                cv2.rectangle(display, (x1, y1 - 20), (x2, y2 + 20), draw_color, 2)

            # Draw mode: only index finger up
            elif fingers[1] == 1 and fingers[2] == 0:
                cv2.circle(display, (x1, y1), 12, draw_color, -1)

                if xp == 0 and yp == 0:
                    xp, yp = x1, y1

                # Optional smoothing
                smooth_x = (x1 + xp) // 2
                smooth_y = (y1 + yp) // 2

                thickness = eraser_thickness if draw_color == (0, 0, 0) else brush_thickness
                cv2.line(canvas, (xp, yp), (smooth_x, smooth_y), draw_color, thickness)

                xp, yp = smooth_x, smooth_y

            else:
                xp, yp = 0, 0

    # Merge drawing canvas with camera frame
    gray_canvas = cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY)
    _, inv = cv2.threshold(gray_canvas, 50, 255, cv2.THRESH_BINARY_INV)
    inv = cv2.cvtColor(inv, cv2.COLOR_GRAY2BGR)

    display = cv2.bitwise_and(display, inv)
    display = cv2.bitwise_or(display, canvas)

    # Draw status text
    draw_status(display, cam_index, cam_backend, draw_color)

    cv2.imshow("Air Paint - NVIDIA Broadcast Ready", display)

    key = cv2.waitKey(1) & 0xFF
    if key == 27:   # ESC
        break

cap.release()
cv2.destroyAllWindows()