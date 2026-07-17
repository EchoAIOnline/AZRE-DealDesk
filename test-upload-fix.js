fetch("https://script.google.com/macros/s/AKfycbyEUeEVnaGj1p-_4qTuHX63i4QekUz6j2AgBKdNpvB8RVq7TojhduR_LILl34rBpOtn/exec", {
  method: 'POST',
  body: JSON.stringify({
    action: 'uploadDocument',
    data: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
    name: 'test.txt',
    mimeType: 'text/plain',
    address: '123 Test St',
    docCategory: 'Other Documents'
  })
}).then(r => r.json()).then(console.log).catch(console.error);
