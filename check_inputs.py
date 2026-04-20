import os
import re

def check_files():
    found_issues = []
    for root_dir, dirs, files in os.walk('components'):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                filepath = os.path.join(root_dir, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.read().split('\n')
                    for i, line in enumerate(lines):
                        if '<input ' in line:
                            # Use regex to find `value={someVar}` without `|| ''` and without `?`
                            match = re.search(r'value=\{([^}]+)\}', line)
                            if match:
                                val = match.group(1).strip()
                                # check if it looks like a variable without fallback
                                if ('||' not in val) and ('?' not in val) and ("'" not in val) and ('"' not in val) and ('`' not in val) and (not val.startswith('formatNumberWithCommas')):
                                    # Could be an offender
                                    found_issues.append(f"{filepath}:{i+1} : value={{{val}}}")
    
    with open('App.tsx', 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')
        for i, line in enumerate(lines):
            if '<input ' in line:
                match = re.search(r'value=\{([^}]+)\}', line)
                if match:
                    val = match.group(1).strip()
                    if ('||' not in val) and ('?' not in val) and ("'" not in val) and ('"' not in val) and ('`' not in val) and (not val.startswith('formatNumberWithCommas')):
                        found_issues.append(f"App.tsx:{i+1} : value={{{val}}}")

    print(f"Found {len(found_issues)} issues:")
    for issue in found_issues:
        print(issue)

check_files()
