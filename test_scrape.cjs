const fs = require('fs');
let envStr = "";
try { envStr = fs.readFileSync('.env', 'utf8'); } catch(e) {}
const env = envStr.split('\n').reduce((acc, line) => {
    const parts = line.split('=');
    if (parts.length > 1) acc[parts[0]] = parts.slice(1).join('=').trim();
    return acc;
}, {});

const url = "https://www.zillow.com/homes/4224-Rocky-Face-Dr-Douglasville-GA-30135_rb/";
const BRIGHTDATA_API_TOKEN = env.BRIGHTDATA_API_KEY || process.env.BRIGHTDATA_API_KEY;

async function test() {
    console.log("Triggering BrightData for", url);
    const triggerRes = await fetch('https://api.brightdata.com/dca/trigger?collector=c_m55i7e8j2p50i6x8i0&queue_next=1', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${BRIGHTDATA_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ url }])
    });
    const triggerData = await triggerRes.json();
    console.log("Trigger Data:", triggerData);
    
    if (!triggerData.collection_id) {
        console.log("No collection ID");
        return;
    }
    
    const collectionId = triggerData.collection_id;
    let attempts = 0;
    while (attempts < 20) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        const statusRes = await fetch(`https://api.brightdata.com/dca/dataset?id=${collectionId}`, {
            headers: { 'Authorization': `Bearer ${BRIGHTDATA_API_TOKEN}` }
        });
        
        if (statusRes.status === 200) {
            const data = await statusRes.json();
            console.log("Got Data. Length:", data.length);
            if (data.length > 0) {
                const item = data[0];
                console.log("homeValuation exists?", !!item.homeValuation);
                if (item.homeValuation) {
                    const hv = typeof item.homeValuation[0] === 'string' ? JSON.parse(item.homeValuation[0]) : item.homeValuation[0];
                    console.log("hv.comparables exists?", !!(hv && hv.comparables));
                    if (hv && hv.comparables && hv.comparables.comps) {
                        console.log("Comps length:", hv.comparables.comps.length);
                        const soldComps = hv.comparables.comps.filter(c => c.property && c.property.homeStatus === 'RECENTLY_SOLD');
                        console.log("Sold comps length:", soldComps.length);
                        if (soldComps.length > 0) {
                            console.log("First sold comp:", soldComps[0].property.address);
                            console.log("Sqft:", soldComps[0].property.livingAreaValue || soldComps[0].property.livingArea);
                        }
                    }
                }
                
                // Print keys to see what's actually in the response
                console.log("Keys in item:", Object.keys(item).slice(0, 10));
            }
            break;
        }
        console.log("Waiting...", statusRes.status);
    }
}
test();
