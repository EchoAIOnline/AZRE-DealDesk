const fs = require('fs');
let content = fs.readFileSync('index.tsx', 'utf8');
content = content.replace(
  "import App from './App';",
  "import App from './App';\n\nwindow.addEventListener('unhandledrejection', (event) => {\n  if (event.reason && event.reason.message && event.reason.message.toLowerCase().includes('refresh token')) {\n    event.preventDefault();\n  }\n});\n"
);
fs.writeFileSync('index.tsx', content);
