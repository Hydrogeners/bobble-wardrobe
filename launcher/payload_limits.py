"""Bounded quality-model payloads; executable bridge budgets stay unchanged."""
MAX_SCRIPT = 6 * 1024 * 1024
MAX_WARDROBE = 24 * 1024 * 1024
MAX_ENVELOPE = 48 * 1024 * 1024

def file_limit(name):
    return MAX_WARDROBE if name == 'wardrobe-live.js' else MAX_SCRIPT
