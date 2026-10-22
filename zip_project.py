import os
import zipfile
from pathlib import Path

# Workspace root directory
root_dir = Path(".").resolve()
output_zip = root_dir / "OfflinePay.zip"

excluded_dirs = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".idea",
    ".vscode"
}

excluded_files = {
    "OfflinePay.zip",
    "zip_project.py"
}

print(f"Creating {output_zip.name}...")

count = 0
with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
    for current_dir, dirs, files in os.walk(root_dir):
        # Prune excluded directories
        dirs[:] = [d for d in dirs if d not in excluded_dirs]

        rel_dir = Path(current_dir).relative_to(root_dir)

        for f in files:
            if f in excluded_files or f.endswith(".pyc") or f.endswith(".pyo"):
                continue

            file_path = Path(current_dir) / f
            arcname = Path("OfflinePay") / rel_dir / f

            try:
                zipf.write(file_path, arcname=str(arcname))
                count += 1
            except Exception as err:
                print(f"Skipping {f}: {err}")

size_mb = output_zip.stat().st_size / (1024 * 1024)
print(f"Done! Added {count} files. Archive size: {size_mb:.2f} MB")
