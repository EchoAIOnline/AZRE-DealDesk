const prev = { id: 1, address: '123' };
const saved = { id: 1, address: '123', createdAt: '2022-01-01' };
const deal = { ...prev, id: saved.id, createdAt: saved.createdAt || prev.createdAt };
const dealRef = prev;
console.log(JSON.stringify(deal) === JSON.stringify(dealRef));
