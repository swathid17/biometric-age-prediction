import torch
import torch.nn.functional as F


class GradCAM:
    """Grad-CAM for a single convolutional target layer (e.g. ResNet layer4)."""

    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.activations = None
        self.gradients = None

        self._fwd_handle = target_layer.register_forward_hook(self._save_activation)
        self._bwd_handle = target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, module, inp, out):
        self.activations = out.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate(self, input_tensor: torch.Tensor, target_class: int | None = None):
        """
        Returns a 2D heatmap in [0, 1] for a single image (batch size 1).
        Gradients are required — do not wrap this call in torch.no_grad().
        """
        self.model.eval()
        input_tensor = input_tensor.requires_grad_(True)

        # Grad-CAM needs autograd even when the model is in eval mode
        with torch.enable_grad():
            logits = self.model(input_tensor)
            if target_class is None:
                target_class = int(logits.argmax(dim=1).item())

            self.model.zero_grad(set_to_none=True)
            score = logits[0, target_class]
            score.backward()

        grads = self.gradients  # [1, C, H, W]
        acts = self.activations  # [1, C, H, W]
        if grads is None or acts is None:
            raise RuntimeError("Grad-CAM hooks did not capture gradients/activations.")

        weights = grads.mean(dim=(2, 3), keepdim=True)  # [1, C, 1, 1]
        cam = (weights * acts).sum(dim=1, keepdim=True)  # [1, 1, H, W]
        cam = F.relu(cam)
        cam = F.interpolate(cam, size=input_tensor.shape[-2:], mode="bilinear", align_corners=False)
        cam = cam.squeeze().cpu()

        cam_min, cam_max = cam.min(), cam.max()
        if cam_max > cam_min:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = torch.zeros_like(cam)

        return cam.numpy()

    def close(self):
        self._fwd_handle.remove()
        self._bwd_handle.remove()
