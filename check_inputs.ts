import fs from 'fs';
import path from 'path';

function checkFiles() {
    const foundIssues: string[] = [];
    
    function walkSync(dir: string, filelist: string[] = []) {
        fs.readdirSync(dir).forEach(file => {
            const filepath = path.join(dir, file);
            if (fs.statSync(filepath).isDirectory()) {
                filelist = walkSync(filepath, filelist);
            } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                filelist.push(filepath);
            }
        });
        return filelist;
    }

    const files = walkSync('components');
    files.push('App.tsx');
    
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('<input ')) {
                const match = line.match(/value=\{([^}]+)\}/);
                if (match) {
                    const val = match[1].trim();
                    if (!val.includes('||') && !val.includes('?') && !val.includes("'") && !val.includes('"') && !val.includes('\`') && !val.startsWith('formatNumberWithCommas')) {
                        foundIssues.push(`${file}:${i+1} : value={${val}}`);
                    }
                }
            }
        }
    }

    console.log(`Found ${foundIssues.length} issues:`);
    for (const issue of foundIssues) {
        console.log(issue);
    }
}

checkFiles();
