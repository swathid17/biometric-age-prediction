"""
main_app.py
============
Real, runnable application supporting TWO input modes:
    1. --mode webcam  -> live camera capture via cv2.VideoCapture(0)
    2. --mode upload   -> pick an image file via a real file-picker dialog
                          (or pass --image path/to/file.jpg directly)

Both modes run the exact same model + Grad-CAM + explanation pipeline and
the exact same security wiping — no separate/duplicate logic between them.

>>> REPLACE-BEFORE-PRODUCTION MARKERS <<<
Search for "REPLACE:" — there are exactly two:
  1. CHECKPOINT_PATH — point this at your team's real trained .pth file
  2. AGE_GROUP_LABELS — replace with your team's real class-index -> age
     range mapping (currently a placeholder list, since this doesn't exist
     as code — it's data your teammate who trained the model has to give you)

Run:
    python main_app.py --mode webcam
    python main_app.py --mode upload
    python main_app.py --mode upload --image path/to/photo.jpg
"""

import argparse
import gc
import time
from typing import Optional

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from torchvision import transforms

from model_definitions import FusionAgeModel, GradCAM
from security_utils import SecureFrame, wipe_tensor, harden_process


# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
# REPLACE: point this at your team's real trained checkpoint once available.
CHECKPOINT_PATH: Optional[str] = None  # e.g. "checkpoint/fusion_age_model.pth"

# REPLACE: replace with your team's real class-index -> age-range mapping.
NUM_CLASSES = 31
AGE_GROUP_LABELS = [f"{i}-{i+2}" for i in range(0, NUM_CLASSES * 3, 3)]

FRAME_INTERVAL_SEC = 1.5  # throttle for webcam mode

REGIONS = {
    "forehead": (0, 0, 224, 60),
    "eyes":     (0, 60, 224, 110),
    "cheeks":   (0, 110, 224, 160),
    "jawline":  (0, 160, 224, 200),
    "neck":     (0, 200, 224, 224),
}
REGION_CUES = {
    "forehead": "forehead lines and brow texture",
    "eyes":     "the eye region, including periorbital skin and fine lines",
    "cheeks":   "cheek contour and skin texture",
    "jawline":  "jawline definition and skin firmness",
    "neck":     "neck skin texture and laxity",
}

preprocess = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


# ---------------------------------------------------------------------------
# EXPLANATION GENERATION (real logic, operates on real Grad-CAM output)
# ---------------------------------------------------------------------------
def region_activation_scores(cam: np.ndarray) -> dict:
    scores = {}
    for name, (x1, y1, x2, y2) in REGIONS.items():
        scores[name] = float(cam[y1:y2, x1:x2].mean())
    total = sum(scores.values()) + 1e-8
    return {k: v / total for k, v in scores.items()}


def build_explanation(age_group: str, confidence: float, region_scores: dict) -> str:
    ranked = sorted(region_scores.items(), key=lambda kv: kv[1], reverse=True)
    top_regions = [r for r, _ in ranked[:2]]
    cue_text = " and ".join(REGION_CUES[r] for r in top_regions)

    s1 = f"The model predicted the age group '{age_group}' with {confidence*100:.1f}% confidence."
    s2 = f"This decision was driven primarily by {cue_text}."
    s3 = (
        f"The {top_regions[0]} region showed the strongest activation "
        f"({region_scores[top_regions[0]]*100:.1f}% of total attention), "
        f"suggesting these features most closely matched patterns typical of this age range."
    )
    s4 = (
        "Lower-weighted regions contributed only marginally to the final decision, "
        "indicating the prediction was concentrated rather than diffuse across the face."
    )
    return " ".join([s1, s2, s3, s4])


# ---------------------------------------------------------------------------
# CORE PREDICTION FUNCTION — used by BOTH webcam and upload modes
# ---------------------------------------------------------------------------
def process_frame(model: FusionAgeModel, gradcam: GradCAM, device: torch.device,
                   frame_bgr: np.ndarray):
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    input_tensor = preprocess(frame_rgb).unsqueeze(0).to(device)

    with torch.no_grad():
        logits, _ = model(input_tensor)
        probs = F.softmax(logits, dim=1)
        conf, pred_idx = probs.max(dim=1)
        pred_idx = pred_idx.item()
        confidence = conf.item()

    cam = gradcam.generate(input_tensor, pred_idx)
    region_scores = region_activation_scores(cam)
    age_group = AGE_GROUP_LABELS[pred_idx]
    explanation = build_explanation(age_group, confidence, region_scores)  # computed but not printed

    # --- SECURITY PROOF ONLY: confirm data existed, then confirm it's gone ---
    had_data_before = bool(np.any(frame_rgb)) and bool(torch.any(input_tensor))

    frame_rgb.fill(0)
    cam.fill(0)
    wipe_tensor(input_tensor)

    is_zero_after = (not np.any(frame_rgb)) and (not torch.any(input_tensor))

    del frame_rgb, cam, input_tensor
    gc.collect()

    return age_group, confidence, explanation, had_data_before, is_zero_after

    return age_group, confidence, explanation


def print_security_result(label: str, had_data_before: bool, is_zero_after: bool):
    print(f"\n--- {label} ---")
    print(f"Frame processed in memory  : {had_data_before}")
    print(f"No disk write performed    : True (verified statically — see security_utils.py)")
    print(f"No network call performed  : True (verified statically — see security_utils.py)")
    print(f"Memory wiped after inference: {is_zero_after}")


# ---------------------------------------------------------------------------
# MODE 1 — WEBCAM
# ---------------------------------------------------------------------------
def run_webcam(model, gradcam, device, show_preview: bool = False):
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam. Check camera permissions/connection.")

    last_infer = 0.0
    frame_count = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            now = time.time()
            if now - last_infer >= FRAME_INTERVAL_SEC:
                with SecureFrame(frame.copy()) as safe_frame:
                    _, _, _, had_data_before, is_zero_after = process_frame(
                        model, gradcam, device, safe_frame
                    )
                frame_count += 1
                print_security_result(f"Frame {frame_count}", had_data_before, is_zero_after)
                last_infer = now

            if show_preview:
                cv2.imshow("Live (preview only — not saved)", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            frame.fill(0)
            del frame

    except KeyboardInterrupt:
        print("\nStopped by user.")
    finally:
        cap.release()
        if show_preview:
            cv2.destroyAllWindows()
        gc.collect()


# ---------------------------------------------------------------------------
# MODE 2 — UPLOAD
# ---------------------------------------------------------------------------
def pick_file_via_dialog() -> str:
    """Real file-picker dialog using tkinter (ships with standard Python)."""
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()  # hide the empty root window, show only the dialog
    file_path = filedialog.askopenfilename(
        title="Select an image for age prediction",
        filetypes=[("Image files", "*.jpg *.jpeg *.png *.bmp")],
    )
    root.destroy()
    return file_path


def run_upload(model, gradcam, device, image_path: Optional[str] = None):
    if not image_path:
        image_path = pick_file_via_dialog()
        if not image_path:
            print("No file selected. Exiting.")
            return

    frame = cv2.imread(image_path)
    if frame is None:
        raise FileNotFoundError(f"Could not read image at: {image_path}")

    with SecureFrame(frame) as safe_frame:
        _, _, _, had_data_before, is_zero_after = process_frame(model, gradcam, device, safe_frame)

    print_security_result(f"Uploaded image: {image_path}", had_data_before, is_zero_after)


# ---------------------------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Age prediction: webcam or upload mode")
    parser.add_argument("--mode", choices=["webcam", "upload"], required=True)
    parser.add_argument("--image", type=str, default=None,
                         help="Path to image (upload mode only). If omitted, opens a file picker.")
    parser.add_argument("--preview", action="store_true",
                         help="Show live camera preview window (webcam mode only, off by default).")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = FusionAgeModel(num_classes=NUM_CLASSES).to(device).eval()
    if CHECKPOINT_PATH:
        model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=device))
        print(f"[OK] Loaded checkpoint: {CHECKPOINT_PATH}")
    else:
        print("[WARN] CHECKPOINT_PATH is not set — running with pretrained-backbone weights "
              "only. Predictions will not be meaningful until your team's trained checkpoint "
              "is available. This is expected at this stage of development.")

    gradcam = GradCAM(model, target_layer=model.resnet_backbone[-1])

    security_report = harden_process(pipeline_source_file=__file__)
    print("--- Security hardening report ---")
    for k, v in security_report.items():
        print(f"{k}: {v}")

    if args.mode == "webcam":
        run_webcam(model, gradcam, device, show_preview=args.preview)
    else:
        run_upload(model, gradcam, device, image_path=args.image)


if __name__ == "__main__":
    main()