const query = "1285 Campbellton Rd SW".toLowerCase().trim();
const addr1 = "1285 Campbellton Rd SW, Atlanta, GA";
console.log(addr1.toLowerCase().includes(query));

const addr2 = "1285 Campbellton Road SW, Atlanta, GA";
console.log(addr2.toLowerCase().includes(query));
