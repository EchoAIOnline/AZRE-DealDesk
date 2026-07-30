const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
    /const handleAddDeal = async \(overrides\?: Partial\<Deal\>\) \=\> \{/,
    `const handleAddDeal = async (overrides?: Partial<Deal>) => {
      if (overrides && 'nativeEvent' in overrides) {
          overrides = undefined;
      }`
);

fs.writeFileSync('App.tsx', code);
