const errMsg = '{"error":{"code":429,"message":"You exceeded your current quota..."}}';
try {
  console.log(JSON.parse(errMsg).error.message);
} catch (e) {
  console.log("fallback");
}
