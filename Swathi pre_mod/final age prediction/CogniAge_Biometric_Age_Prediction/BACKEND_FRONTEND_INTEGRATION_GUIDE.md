# CogniAge: Backend-to-Frontend Connection & Architecture Guide

## 1. Are the Files in the File Explorer Already Updated?

**YES, 100%.**
All changes have been made **directly in-place** inside the workspace files on your disk at:
`c:\Users\varsh\Downloads\CogniAge_Biometric_Age_Prediction\`

Specifically:
- [`main_server.py`](file:///c:/Users/varsh/Downloads/CogniAge_Biometric_Age_Prediction/main_server.py) — Contains the complete SOTA hybrid neural model, YuNet face alignment, CLAHE normalization, dual-view symmetry inference, explainability Grad-CAM engine, and FastAPI static server.
- [`cogniage-frontend/js/script.js`](file:///c:/Users/varsh/Downloads/CogniAge_Biometric_Age_Prediction/cogniage-frontend/js/script.js) — Contains the 5-factor multi-modal liveness engine (7-second evaluation, blink EAR, 3D head yaw perspective, depth disparity, challenge-response), single-shot inference trigger, stateless session reset, and UI rendering.
- [`cogniage-frontend/index.html`](file:///c:/Users/varsh/Downloads/CogniAge_Biometric_Age_Prediction/cogniage-frontend/index.html) — Contains the modern UI layout, scanner HUD, challenge prompts, and explainability modals.
- [`cogniage-frontend/css/style.css`](file:///c:/Users/varsh/Downloads/CogniAge_Biometric_Age_Prediction/cogniage-frontend/css/style.css) — Contains the design system, animations, responsive grid, and dark/light themes.

> **Note**: You do **not** need to copy/paste anything manually. The files you see in your file explorer are already updated, complete, and verified.

---

## 2. How the Backend & Frontend Connect (In Detail)

The communication architecture uses a **Unified FastAPI Server + Asynchronous REST API over HTTP/JSON**:

```
+--------------------------------------------------------------------------------+
|                             CLIENT / BROWSER                                   |
|                                                                                |
|  +---------------------------+             +--------------------------------+  |
|  |   MediaPipe FaceMesh      |             |     HTML5 Camera Video Stream  |  |
|  |   468 3D Landmarks        |             |   (Hardware Webcam Capture)    |  |
|  +-------------+-------------+             +---------------+----------------+  |
|                |                                           |                   |
|                v                                           v                   |
|  +--------------------------------------------------------------------------+  |
|  |             Multi-Modal Liveness Engine (script.js)                      |  |
|  |   * 5-Factor Score >= 0.70 (Blink, 3D Yaw, Depth, Texture, Challenge)    |  |
|  +-------------------------------------+------------------------------------+  |
|                                        | (Liveness Verified -> Capture Frame)  |
|                                        v                                       |
|  +--------------------------------------------------------------------------+  |
|  |  Offscreen Canvas -> Base64 JPEG Snapshot -> sendFrameToBackend()        |  |
|  +-------------------------------------+------------------------------------+  |
+----------------------------------------|---------------------------------------+
                                         | HTTP POST /api/predict-age (JSON Base64)
                                         v
+--------------------------------------------------------------------------------+
|                        BACKEND SERVER (main_server.py)                         |
|                                                                                |
|  1. FastAPI Endpoint: Receives `PredictRequest` JSON payload                   |
|  2. Image Decoder: Converts Base64 -> OpenCV BGR NumPy array                  |
|  3. Neural Face Alignment: YuNet detects primary face & rotates eye-level     |
|  4. Preprocessing: Exact 20% bounding margin + CLAHE contrast normalization   |
|  5. PyTorch Inference: SOTA ConvNeXt + Swin-Transformer (Dual-View TTA)       |
|  6. Grad-CAM Engine: Generates attention heatmaps & human explainability JSON |
|  7. Memory Purge: Explicit `del` and `gc.collect()` (Stateless / Private)     |
+----------------------------------------+---------------------------------------+
                                         | HTTP JSON Response (Age, Conf, Heatmap)
                                         v
+--------------------------------------------------------------------------------+
|                             CLIENT / BROWSER                                   |
|                                                                                |
|  1. Halts Camera Hardware: `stream.getTracks().forEach(t => t.stop())`         |
|  2. UI Lock & Render: Displays Age, Age Range, Confidence, and Error Margin   |
|  3. Modal Hydration: Shows Grad-CAM Heatmap & Plain-Language Explanations      |
|  4. State Reset Ready: "Predict Again" cleanses all buffers for next user      |
+--------------------------------------------------------------------------------+
```

---

### Step-by-Step Connection Lifecycle

#### A. Unified Server Mounting & Zero-CORS Setup
In [`main_server.py`](file:///c:/Users/varsh/Downloads/CogniAge_Biometric_Age_Prediction/main_server.py):
1. FastAPI mounts the `cogniage-frontend` folder as the root static directory:
   ```python
   app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")
   ```
   When you open `http://127.0.0.1:8000`, the server directly serves `index.html` and its assets from the same origin, eliminating cross-origin permission blockers.
2. `CORSMiddleware` is configured to allow requests from any development port (`localhost:3000`, `127.0.0.1:5500`, etc.):
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

#### B. Heartbeat & Health Check
When the browser page loads, [`cogniage-frontend/js/script.js`](file:///c:/Users/varsh/Downloads/CogniAge_Biometric_Age_Prediction/cogniage-frontend/js/script.js) executes:
```javascript
fetch("http://127.0.0.1:8000/api/health")
```
When FastAPI responds with `{"status": "online", "model_loaded": true}`, the UI status pill updates to green: **`API: Connected`**.

#### C. Liveness Verification to Single-Shot Trigger
1. During the 7-second evaluation window, MediaPipe tracks 468 landmarks locally in the browser at 60 FPS.
2. Once the composite score reaches $\ge 0.70$ and a verified physiological blink or 3D head turn occurs:
   ```javascript
   if (livenessState === 'live' && !livenessEngine.hasTriggeredPrediction) {
       livenessEngine.hasTriggeredPrediction = true;
       triggerInferenceFromVideo();
   }
   ```

#### D. Base64 Frame Capture & Asynchronous `fetch()` Call
1. In `triggerInferenceFromVideo()`, the active `<video>` frame is drawn onto an offscreen canvas and exported to a high-quality base64 string:
   ```javascript
   const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.95);
   ```
2. `sendFrameToBackend(dataUrl)` sends an HTTP `POST` request to `/api/predict-age`:
   ```javascript
   const response = await fetch(`${currentBackendUrl}/api/predict-age`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
           image_base64: imageDataUrl,
           options: { enable_gradcam: true }
       }),
       signal: currentAbortController.signal
   });
   const data = await response.json();
   ```

#### E. Backend Neural Processing & Memory Cleanup
1. In [`main_server.py`](file:///c:/Users/varsh/Downloads/CogniAge_Biometric_Age_Prediction/main_server.py), FastAPI decodes the base64 image into memory.
2. YuNet detects the face bounding box, aligns eyes horizontally, crops with the exact 20% margin, applies CLAHE, and feeds the tensor through the SOTA Hybrid ConvNeXt + Swin model.
3. Grad-CAM computes regional feature saliency (periocular, forehead, nasolabial, jawline).
4. All tensors and intermediate frame buffers are explicitly deleted with `del` and `gc.collect()`.

#### F. Frontend Hydration & Hardware Release
1. Frontend receives the JSON response and calls:
   ```javascript
   finalizeAndReleaseHardware(false);
   ```
   This immediately shuts off the webcam hardware stream (`stream.getTracks().forEach(t => t.stop())`).
2. The UI renders the final age, confidence percentage, age range, error margin, and populates the Explainability modal.

---

## 3. How to Run & Verify

1. Start the server from your project directory:
   ```powershell
   python main_server.py
   ```
2. Open your browser to:
   ```
   http://127.0.0.1:8000
   ```
3. Both the live camera liveness check and photo upload will communicate with the backend.
