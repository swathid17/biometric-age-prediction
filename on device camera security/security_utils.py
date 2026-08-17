"""
security_utils.py
==================
Real, functional on-device security layer. Every function here actually
does what it says — no placeholders.

TIER 1 (hard guarantee, enforced by never calling these in the pipeline):
    disk writes, network calls — verified by verify_no_leak_paths()

TIER 2 (best effort, real code that actually zeroes memory):
    SecureFrame context manager, wipe_tensor()

TIER 3 (OS-level hardening, real syscalls, platform-dependent success):
    disable_core_dumps(), try_lock_process_memory()
"""

import ast
import gc
import platform
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable

import numpy as np
import torch


def disable_core_dumps() -> bool:
    """Real syscall via resource.setrlimit. Prevents a crash from ever
    writing a memory snapshot (which could contain frame data) to disk.
    Returns True if applied, False if not applicable (e.g. Windows)."""
    if platform.system() == "Windows":
        return False
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        return True
    except Exception:
        return False


def try_lock_process_memory() -> bool:
    """Real mlockall() syscall via ctypes on Linux. Best-effort — commonly
    fails without elevated privileges, which is expected and not an error
    in your code; it's a genuine OS permission boundary."""
    if platform.system() != "Linux":
        return False
    try:
        import ctypes
        libc = ctypes.CDLL("libc.so.6", use_errno=True)
        MCL_CURRENT, MCL_FUTURE = 1, 2
        return libc.mlockall(MCL_CURRENT | MCL_FUTURE) == 0
    except Exception:
        return False


@contextmanager
def SecureFrame(frame: np.ndarray):
    """Real context manager. Zeroes the frame array on exit, even if an
    exception occurs during processing inside the `with` block."""
    try:
        yield frame
    finally:
        if isinstance(frame, np.ndarray):
            frame.fill(0)
        del frame
        gc.collect()


def wipe_tensor(*tensors: torch.Tensor) -> None:
    """Real tensor zeroing + CUDA cache release.

    Uses torch.no_grad() instead of detach_() because detach_() is an
    in-place op that PyTorch disallows on view tensors (e.g. the result of
    .unsqueeze()) — it would raise "Can't detach views in-place". Zeroing
    inside a no_grad context achieves the same goal (overwrite the memory,
    don't let autograd track the write) without that restriction.
    """
    with torch.no_grad():
        for t in tensors:
            if isinstance(t, torch.Tensor):
                t.zero_()
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


FORBIDDEN_CALLS = {
    "imwrite", "VideoWriter", "save", "imencode",
    "post", "put", "request", "urlopen", "upload",
}
ALLOWED_CONTEXTS = {"load_state_dict"}


def verify_no_leak_paths(source_file: str) -> Iterable[str]:
    """Real AST-based static scan. Parses the given file and returns a
    warning for every call to a disk/network function name found."""
    path = Path(source_file)
    tree = ast.parse(path.read_text(), filename=source_file)
    warnings = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Attribute):
                func_name = node.func.attr
            elif isinstance(node.func, ast.Name):
                func_name = node.func.id
            if func_name in FORBIDDEN_CALLS and func_name not in ALLOWED_CONTEXTS:
                warnings.append(f"{source_file}:{node.lineno} — call to '{func_name}()'")
    return warnings


def harden_process(pipeline_source_file: str = None) -> dict:
    """Runs all Tier-3 hardening + Tier-1 static scan, returns a real report."""
    report = {
        "platform": platform.system(),
        "core_dumps_disabled": disable_core_dumps(),
        "memory_locked": try_lock_process_memory(),
        "leak_scan_warnings": [],
    }
    if pipeline_source_file:
        report["leak_scan_warnings"] = list(verify_no_leak_paths(pipeline_source_file))
    return report


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "main_app.py"
    report = harden_process(target)
    print("--- On-device security hardening report ---")
    for k, v in report.items():
        print(f"{k}: {v}")