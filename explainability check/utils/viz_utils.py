import numpy as np
import matplotlib.pyplot as plt


IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def denormalize(img_hwc: np.ndarray) -> np.ndarray:
    """Undo ImageNet normalization. Expects HWC float tensor/array."""
    img = np.asarray(img_hwc, dtype=np.float32)
    img = img * IMAGENET_STD + IMAGENET_MEAN
    return np.clip(img, 0.0, 1.0)


def show_heatmap_on_image(img_hwc, heatmap, alpha: float = 0.45, save_path: str = "gradcam_overlay.png"):
    """Overlay Grad-CAM heatmap on an image and save/show the result."""
    if hasattr(img_hwc, "numpy"):
        img_hwc = img_hwc.numpy()
    img = denormalize(img_hwc)
    heat = np.asarray(heatmap, dtype=np.float32)

    cmap = plt.get_cmap("jet")
    heat_rgb = cmap(heat)[..., :3]

    overlay = (1.0 - alpha) * img + alpha * heat_rgb
    overlay = np.clip(overlay, 0.0, 1.0)

    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    axes[0].imshow(img)
    axes[0].set_title("Input")
    axes[0].axis("off")

    axes[1].imshow(heat, cmap="jet")
    axes[1].set_title("Grad-CAM")
    axes[1].axis("off")

    axes[2].imshow(overlay)
    axes[2].set_title("Overlay")
    axes[2].axis("off")

    plt.tight_layout()
    fig.savefig(save_path, dpi=150, bbox_inches="tight")
    print(f"Saved Grad-CAM overlay to {save_path}")
    try:
        plt.show()
    except Exception:
        pass
    plt.close(fig)
