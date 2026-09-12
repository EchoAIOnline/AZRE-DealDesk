const fs = require('fs');

let fileContent = fs.readFileSync('./components/Deals/BuyerMatchModal.tsx', 'utf8');

const searchStr = `                if (geoMatch && (counties.length > 0 || cities.length > 0)) reasons.push("Location Match");
            }`;

const insertStr = `                if (geoMatch && (counties.length > 0 || cities.length > 0)) reasons.push("Location Match");
            }

            if (neighborhoods.length > 0 && dealNeighborhood) {
                const isNbMatch = neighborhoods.some(n => {
                    const lowerN = n.toLowerCase().trim();
                    if (!lowerN) return false;
                    return (
                        (dealNeighborhood && (dealNeighborhood.includes(lowerN) || lowerN.includes(dealNeighborhood))) ||
                        (dealCity && (dealCity.includes(lowerN) || lowerN.includes(dealCity))) ||
                        (dealCounty && (dealCounty.includes(lowerN) || lowerN.includes(dealCounty)))
                    );
                });
                if (!isNbMatch) return { buyer, matchScore: 0, reasons: [] as string[] };
                reasons.push("Neighborhood Match");
            }`;

fileContent = fileContent.replace(searchStr, insertStr);

const scoreStr = `if (reasons.some(r => r.includes("Zip Match") || r.includes("Location Match"))) finalScore += 3;`;
const scoreInsert = `if (reasons.some(r => r.includes("Zip Match") || r.includes("Location Match") || r.includes("Neighborhood Match"))) finalScore += 3;`;

fileContent = fileContent.replace(scoreStr, scoreInsert);

fs.writeFileSync('./components/Deals/BuyerMatchModal.tsx', fileContent);
console.log("Patched neighborhoods!");
