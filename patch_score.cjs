const fs = require('fs');

let fileContent = fs.readFileSync('./components/Deals/BuyerMatchModal.tsx', 'utf8');

fileContent = fileContent.replace('return { buyer, matchScore: reasons.length, reasons };', `
            // Restore Score
            let finalScore = 0;
            if (reasons.includes("Strategy Match")) finalScore += 2;
            if (reasons.includes("Criteria Match")) finalScore += 2;
            if (reasons.some(r => r.includes("Zip Match") || r.includes("Location Match"))) finalScore += 3;
            
            return { buyer, matchScore: finalScore, reasons };
`);

fs.writeFileSync('./components/Deals/BuyerMatchModal.tsx', fileContent);
console.log("Patched score!");
