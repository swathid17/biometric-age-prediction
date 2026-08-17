import argparse

import torch
from torchvision import transforms

from explainability.gradcam import GradCAM
from models.fusion_model import ResNetSwinFusion
from utils.data_utils import get_dataloaders, get_transforms
from utils.explain_utils import generate_text_explanation, prediction_confidence


def load_model(device: torch.device, num_classes: int = 31) -> ResNetSwinFusion:
    model = ResNetSwinFusion(num_classes=num_classes).to(device)
    model.eval()
    return model


def explain_frame(model, image_tensor: torch.Tensor, device: torch.device) -> str:
    """Run inference + Grad-CAM and return a textual explanation."""
    single_image = image_tensor.unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(single_image)

    pred_class = int(logits.argmax(dim=1).item())
    confidence = prediction_confidence(logits, pred_class)

    gradcam = GradCAM(model, model.resnet.layer4[-1])
    try:
        heatmap = gradcam.generate(single_image, target_class=pred_class)
    finally:
        gradcam.close()

    from utils.explain_utils import analyze_heatmap_regions

    region_scores = analyze_heatmap_regions(heatmap)
    return generate_text_explanation(pred_class, confidence, region_scores)


def run_dataset_demo(model, device: torch.device) -> None:
    train_loader, _ = get_dataloaders("processed/train", "processed/test", batch_size=4)
    images, _ = next(iter(train_loader))
    explanation = explain_frame(model, images[0], device)
    print("\n--- Age prediction explanation ---")
    print(explanation)


def run_webcam_demo(model, device: torch.device, camera_index: int = 0) -> None:
    try:
        import cv2
    except ImportError as exc:
        raise SystemExit(
            "Webcam mode requires opencv-python. Install with: pip install opencv-python"
        ) from exc

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise SystemExit(f"Could not open webcam at index {camera_index}.")

    transform = get_transforms()
    print("Webcam ready. Press SPACE to capture and explain, Q to quit.")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("Failed to read from webcam.")
                break

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = transforms.ToPILImage()(rgb)
            tensor = transform(pil_image)

            cv2.imshow("Webcam (SPACE=explain, Q=quit)", frame)
            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                break
            if key == ord(" "):
                explanation = explain_frame(model, tensor, device)
                print("\n--- Age prediction explanation ---")
                print(explanation)
    finally:
        cap.release()
        cv2.destroyAllWindows()


def main() -> None:
    parser = argparse.ArgumentParser(description="Fusion model Grad-CAM textual explanations")
    parser.add_argument(
        "--source",
        choices=("dataset", "webcam"),
        default="dataset",
        help="Input source: processed dataset image or live webcam frame",
    )
    parser.add_argument("--camera", type=int, default=0, help="Webcam device index")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    model = load_model(device)

    if args.source == "webcam":
        run_webcam_demo(model, device, camera_index=args.camera)
    else:
        run_dataset_demo(model, device)


if __name__ == "__main__":
    main()
