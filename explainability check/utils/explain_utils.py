from __future__ import annotations

import numpy as np
import torch


# Normalized (x_min, y_min, x_max, y_max) regions for a centered face crop.
FACIAL_REGIONS: dict[str, tuple[float, float, float, float]] = {
    "forehead and hairline": (0.05, 0.00, 0.95, 0.28),
    "eyes and brow area": (0.05, 0.22, 0.95, 0.42),
    "nose": (0.25, 0.40, 0.75, 0.58),
    "mouth and cheeks": (0.05, 0.52, 0.95, 0.72),
    "chin and jawline": (0.15, 0.68, 0.85, 0.88),
    "neck and lower face": (0.05, 0.82, 0.95, 1.00),
}


def age_group_label(class_idx: int) -> str:
    """Map class index to a readable age-group label (31 bins: ages 0-30)."""
    if class_idx == 0:
        return "a newborn or very young baby"
    if class_idx == 1:
        return "about 1 year old"
    return f"about {class_idx} years old"


def prediction_confidence(logits: torch.Tensor, class_idx: int) -> float:
    probs = torch.softmax(logits, dim=1)
    return float(probs[0, class_idx].item() * 100.0)


def analyze_heatmap_regions(
    heatmap: np.ndarray,
    threshold: float = 0.35,
) -> list[tuple[str, float]]:
    """Return facial regions ranked by Grad-CAM activation mass."""
    heat = np.asarray(heatmap, dtype=np.float32)
    h, w = heat.shape
    active = heat >= threshold

    scores: list[tuple[str, float]] = []
    for name, (x0, y0, x1, y1) in FACIAL_REGIONS.items():
        xs, xe = int(x0 * w), max(int(x1 * w), int(x0 * w) + 1)
        ys, ye = int(y0 * h), max(int(y1 * h), int(y0 * h) + 1)
        patch = heat[ys:ye, xs:xe]
        mask = active[ys:ye, xs:xe]
        if patch.size == 0:
            scores.append((name, 0.0))
            continue
        # Weight by both intensity and how much of the region is salient.
        mass = float(patch.sum())
        salient_ratio = float(mask.mean()) if mask.size else 0.0
        scores.append((name, mass * (0.5 + salient_ratio)))

    scores.sort(key=lambda item: item[1], reverse=True)
    return scores


def _join_regions(names: list[str]) -> str:
    if not names:
        return "no dominant facial region"
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return ", ".join(names[:-1]) + f", and {names[-1]}"


def generate_text_explanation(
    pred_class: int,
    confidence: float,
    region_scores: list[tuple[str, float]],
    min_region_share: float = 0.12,
) -> str:
    """
    Build a 3-4 sentence explanation from Grad-CAM facial-region activations.
    """
    if not region_scores or region_scores[0][1] <= 0:
        top_regions = ["the central face"]
        secondary_regions: list[str] = []
    else:
        total = sum(score for _, score in region_scores) or 1.0
        top_regions = [
            name
            for name, score in region_scores
            if score / total >= min_region_share
        ][:2]
        secondary_regions = [
            name
            for name, score in region_scores
            if name not in top_regions and score / total >= min_region_share * 0.6
        ][:2]

    label = age_group_label(pred_class)
    primary = _join_regions(top_regions)
    secondary = _join_regions(secondary_regions)

    sentences = [
        (
            f"We think this person is {label}. "
            f"The system is about {confidence:.0f}% confident in this guess."
        ),
        (
            f"It looked most closely at the {primary} when deciding the age. "
            f"These parts of the face had the biggest effect on the result."
        ),
    ]

    if secondary_regions:
        sentences.append(
            f"It also paid some attention to the {secondary}, "
            f"which helped support the age estimate."
        )
        sentences.append(
            f"In short, the guess came mainly from facial features in these areas, "
            f"not from the background or surroundings."
        )
    else:
        sentences.append(
            f"The system focused mainly on the {primary} "
            f"and did not rely much on other parts of the image."
        )
        sentences.append(
            f"This means the age estimate is based mostly on what it saw "
            f"in those highlighted areas of the face."
        )

    return " ".join(sentences[:4])
