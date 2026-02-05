#!/usr/bin/env python3
import re
import os

os.chdir('/Users/sunwoo/Desktop/코딩/BIS athletics')

files = ['index.html', 'upcoming.html', 'kisaa-kaiac.html', 'team.html', 'details.html']

for filename in files:
    if not os.path.exists(filename):
        print(f"Skipping {filename} - not found")
        continue
    
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to find the * { box-sizing... } rule and add html, body rules after it
    pattern = r'(\*\s*\{\s*\n?\s*box-sizing:\s*border-box;\s*\n?\s*margin:\s*0;\s*\n?\s*padding:\s*0;\s*\n?\s*\})'
    
    # Check if html, body rule already exists
    if 'html, body {' in content or 'html,body{' in content:
        print(f"{filename} - already has html, body rule")
        continue
    
    # Add html, body rule after * rule
    replacement = r'''\1

                        html, body {
                                margin: 0 !important;
                                padding: 0 !important;
                                border: 0 !important;
                                width: 100%;
                                overflow-x: hidden;
                        }'''
    
    new_content = re.sub(pattern, replacement, content)
    
    if new_content != content:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"{filename} - updated")
    else:
        print(f"{filename} - no changes made")

print("Done!")
