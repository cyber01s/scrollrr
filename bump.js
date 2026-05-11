const fs = require('fs');
let text = fs.readFileSync('server.ts', 'utf8');
text = text.replace(/:v1:/g, ':v2:');
fs.writeFileSync('server.ts', text);
