import re

with open('/app/applet/App.tsx', 'r') as f:
    content = f.read()

old_search_logic = """    const activeSearch = globalSearchQuery.trim() || pipelineSearch.trim();
    if (activeSearch) {
        const query = (activeSearch || "").toLowerCase().trim();
        filtered = filtered.filter(d => ( (d.address && String(d.address).toLowerCase().includes(query)) || (d.mls && String(d.mls).toLowerCase().includes(query)) || (d.agentName && String(d.agentName).toLowerCase().includes(query)) ));
    }"""

new_search_logic = """    const activeSearch = globalSearchQuery.trim() || pipelineSearch.trim();
    if (activeSearch) {
        const normalizeStr = (str: string) => {
            if (!str) return "";
            let s = String(str).toLowerCase().replace(/[,.]/g, ' ');
            s = s.replace(/\\b(rd|road)\\b/g, 'road');
            s = s.replace(/\\b(st|street)\\b/g, 'street');
            s = s.replace(/\\b(ave|avenue)\\b/g, 'avenue');
            s = s.replace(/\\b(dr|drive)\\b/g, 'drive');
            s = s.replace(/\\b(ln|lane)\\b/g, 'lane');
            s = s.replace(/\\b(blvd|boulevard)\\b/g, 'boulevard');
            s = s.replace(/\\b(ct|court)\\b/g, 'court');
            s = s.replace(/\\b(pl|place)\\b/g, 'place');
            s = s.replace(/\\b(ter|terrace)\\b/g, 'terrace');
            s = s.replace(/\\b(pkwy|parkway)\\b/g, 'parkway');
            s = s.replace(/\\b(hwy|highway)\\b/g, 'highway');
            s = s.replace(/\\b(cir|circle)\\b/g, 'circle');
            return s;
        };
        const queryTerms = normalizeStr(activeSearch).split(/\\s+/).filter(t => t.length > 0);
        
        filtered = filtered.filter(d => {
            const addr = normalizeStr(d.address || "");
            const mls = normalizeStr(d.mls || "");
            const agent = normalizeStr(d.agentName || "");
            
            return queryTerms.every(term => 
                addr.includes(term) || 
                mls.includes(term) || 
                agent.includes(term)
            );
        });
    }"""

if old_search_logic in content:
    content = content.replace(old_search_logic, new_search_logic)
    with open('/app/applet/App.tsx', 'w') as f:
        f.write(content)
    print("Patched App.tsx")
else:
    print("Could not find search logic in App.tsx")
