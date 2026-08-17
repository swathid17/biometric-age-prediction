"""
model_definitions.py
=====================
Fusion model (ResNet50 + Swin-T) and Grad-CAM. Fully functional, real code —
uses actual torchvision architectures and real forward/backward passes.

The ONLY thing that isn't "real" here is the classifier head's WEIGHTS,
because you don't have your trained checkpoint yet. The architecture itself,
the Grad-CAM hooks, and the math are all genuine and will run correctly the
moment you call load_state_dict() with your real .pth file.

>>> REPLACE-BEFORE-PRODUCTION MARKERS <<<
Search this file for "REPLACE:" to find the exact two things that must come
from your team (architecture must match your trained checkpoint's layer
names exactly, or load_state_dict will throw a key-mismatch error).
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models


class FusionAgeModel(nn.Module):
    """
    ResNet50 -> 2048-d feature vector
    Swin-T   -> 768-d feature vector
    Concatenated -> 2816-d fused vector -> classifier -> num_classes logits

    REPLACE: if your team's actual architecture differs (different layer
    ordering, extra normalization, different classifier depth), copy their
    real class definition in here instead of this one. The signature
    (forward returns logits AND the resnet feature map, for Grad-CAM) must
    stay the same, or update GradCAM's target_layer reference accordingly.
    """

    def __init__(self, num_classes: int):
        super().__init__()

        resnet = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
        # keep everything up to (and including) layer4, drop avgpool+fc
        self.resnet_backbone = nn.Sequential(*list(resnet.children())[:-2])
        self.resnet_pool = nn.AdaptiveAvgPool2d(1)

        swin = models.swin_t(weights=models.Swin_T_Weights.IMAGENET1K_V1)
        # drop the final classification head, keep feature extractor
        self.swin_backbone = nn.Sequential(*list(swin.children())[:-1])

        self.classifier = nn.Sequential(
            nn.Linear(2048 + 768, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes),
        )

    def forward(self, x: torch.Tensor):
        resnet_feat_map = self.resnet_backbone(x)              # [B, 2048, 7, 7]
        resnet_feat = self.resnet_pool(resnet_feat_map).flatten(1)  # [B, 2048]

        swin_feat = self.swin_backbone(x).flatten(1)             # [B, 768]

        fused = torch.cat([resnet_feat, swin_feat], dim=1)        # [B, 2816]
        logits = self.classifier(fused)
        return logits, resnet_feat_map


class GradCAM:
    """
    Real Grad-CAM: registers forward/backward hooks on the ResNet's last
    conv block, runs an actual backward pass to get gradients, and computes
    a genuine class-activation heatmap. No mocked/faked output.
    """

    def __init__(self, model: FusionAgeModel, target_layer: nn.Module):
        self.model = model
        self.activations = None
        self.gradients = None
        target_layer.register_forward_hook(self._save_activation)
        target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, module, inp, out):
        self.activations = out

    def _save_gradient(self, module, grad_in, grad_out):
        self.gradients = grad_out[0]

    def generate(self, input_tensor: torch.Tensor, class_idx: int) -> "np.ndarray":
        import numpy as np

        self.model.zero_grad()
        logits, _ = self.model(input_tensor)
        score = logits[0, class_idx]
        score.backward(retain_graph=False)

        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = F.relu((weights * self.activations).sum(dim=1, keepdim=True))
        cam = F.interpolate(cam, size=(224, 224), mode="bilinear", align_corners=False)
        cam = cam.squeeze().detach().cpu().numpy()
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

        self.activations = None
        self.gradients = None
        return cam