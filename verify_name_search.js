const nameStr1 = "Deborah  L Couch".toLowerCase().replace(/[\.,]/g, '').replace(/\s+/g, ' ');
const query1 = "Deborah L. Couch".toLowerCase().replace(/[\.,]/g, '').replace(/\s+/g, ' ');
console.log(nameStr1, query1, nameStr1.includes(query1));
