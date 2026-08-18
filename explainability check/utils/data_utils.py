from pathlib import Path

from torch.utils.data import DataLoader
from torchvision import datasets, transforms


IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def get_transforms(image_size: int = 224):
    return transforms.Compose(
        [
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )


def get_dataloaders(
    train_dir: str,
    test_dir: str,
    batch_size: int = 8,
    image_size: int = 224,
    num_workers: int = 0,
):
    transform = get_transforms(image_size)

    train_path = Path(train_dir)
    test_path = Path(test_dir)
    if not train_path.exists():
        raise FileNotFoundError(f"Train directory not found: {train_path.resolve()}")
    if not test_path.exists():
        raise FileNotFoundError(f"Test directory not found: {test_path.resolve()}")

    train_ds = datasets.ImageFolder(str(train_path), transform=transform)
    test_ds = datasets.ImageFolder(str(test_path), transform=transform)

    train_loader = DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
    )
    test_loader = DataLoader(
        test_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
    )
    return train_loader, test_loader
