const fs = require('fs');
if (fs.existsSync('./db.json')) {
    const data = JSON.parse(fs.readFileSync('./db.json', 'utf8'));
    console.log("Deals count:", data.Deals ? data.Deals.length : 0);
    if (data.Deals) {
        console.log("Sample deal:", data.Deals[0]);
    }
} else {
    console.log("db.json not found");
}
