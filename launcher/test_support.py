"""Portable location for isolated filesystem fixtures; never a Discord profile."""
import os
from pathlib import Path

preferred = Path(r'Z:\Temp\opencode')
TEST_TEMP = os.environ.get('WARDROBE_TEST_TEMP') or (str(preferred) if preferred.is_dir() else None)
