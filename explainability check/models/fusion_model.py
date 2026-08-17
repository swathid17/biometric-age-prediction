import torch
import torch.nn as nn
from torchvision import models
from torchvision.models import ResNet50_Weights, Swin_T_Weights


class ResNetSwinFusion(nn.Module):
    """Age-prediction fusion model: ResNet50 (2048-d) + Swin-T (768-d) = 2816-d."""

    RESNET_DIM = 2048
    SWIN_DIM = 768
    FUSED_DIM = RESNET_DIM + SWIN_DIM  # 2816

    def __init__(self, num_classes: int = 31, dropout: float = 0.3):
        super().__init__()

        # Keep full ResNet so Grad-CAM can hook model.resnet.layer4[-1]
        self.resnet = models.resnet50(weights=ResNet50_Weights.DEFAULT)
        self.resnet.fc = nn.Identity()

        self.swin = models.swin_t(weights=Swin_T_Weights.DEFAULT)
        self.swin.head = nn.Identity()

        # LayerNorm (not BatchNorm1d) so batch size = 1 works for Grad-CAM
        self.fusion = nn.Sequential(
            nn.Linear(self.FUSED_DIM, 512),
            nn.LayerNorm(512),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(512, num_classes),
        )

        self._debug_printed = False

    @staticmethod
    def _pool_to_vector(feat: torch.Tensor) -> torch.Tensor:
        """Ensure backbone output is [B, C] regardless of spatial layout."""
        if feat.ndim == 4:
            # NCHW (ResNet before flatten) or rare spatial maps
            feat = torch.nn.functional.adaptive_avg_pool2d(feat, 1)
            feat = torch.flatten(feat, 1)
        elif feat.ndim == 3:
            # Swin-style [B, L, C] or [B, C, L] — pool over sequence dim
            if feat.shape[-1] in (ResNetSwinFusion.RESNET_DIM, ResNetSwinFusion.SWIN_DIM):
                feat = feat.mean(dim=1)
            else:
                feat = feat.mean(dim=-1)
        elif feat.ndim == 2:
            pass
        else:
            feat = torch.flatten(feat, 1)
        return feat

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        res_feat = self._pool_to_vector(self.resnet(x))
        swin_feat = self._pool_to_vector(self.swin(x))

        # Guard against accidental channel mismatches before concat
        if res_feat.shape[-1] != self.RESNET_DIM:
            raise RuntimeError(
                f"ResNet feature dim {res_feat.shape[-1]} != {self.RESNET_DIM}. "
                f"Got shape {tuple(res_feat.shape)}"
            )
        if swin_feat.shape[-1] != self.SWIN_DIM:
            raise RuntimeError(
                f"Swin feature dim {swin_feat.shape[-1]} != {self.SWIN_DIM}. "
                f"Got shape {tuple(swin_feat.shape)}"
            )

        fused = torch.cat([res_feat, swin_feat], dim=1)

        if not self._debug_printed:
            print(f"res_feat.shape: {res_feat.shape}")
            print(f"swin_feat.shape: {swin_feat.shape}")
            print(f"fused.shape: {fused.shape}")
            self._debug_printed = True

        return self.fusion(fused)
