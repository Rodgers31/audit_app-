#!/usr/bin/env python3
"""Fix emoji encoding issues for Windows console"""

import os

def fix_emojis(filepath):
    """Replace emojis with ASCII-safe text"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    replacements = {
        '📊': '[DATA]',
        '✅': '[OK]',
        '❌': '[ERROR]',
        '⚠️': '[WARN]',
        '📜': '[CERT]',
        '🔄': '[REFRESH]',
        '\U0001f4ca': '[DATA]',  # bar chart emoji
        '\u2705': '[OK]',        # check mark
        '\u274c': '[ERROR]',     # cross mark
        '\u26a0': '[WARN]',      # warning
        '\U0001f4dc': '[CERT]',  # scroll emoji
    }
    
    for emoji, replacement in replacements.items():
        content = content.replace(emoji, replacement)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed: {filepath}")

# Files to fix
files = [
    'etl/knbs_parser.py',
    'etl/kenya_pipeline.py',
    'extractors/government/knbs_extractor.py',
]

for f in files:
    path = os.path.join(os.path.dirname(__file__), f)
    if os.path.exists(path):
        fix_emojis(path)

print("All emoji fixes complete!")
