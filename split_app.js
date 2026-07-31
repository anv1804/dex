const fs = require('fs');
const lines = fs.readFileSync('renderer/js/app.js', 'utf8').split('\n');

function write(file, startStr, endStr) {
  let start = lines.findIndex(l => l.includes(startStr));
  let end = endStr ? lines.findIndex((l, i) => i > start && l.includes(endStr)) : lines.length;
  if (start !== -1 && end !== -1) {
    fs.writeFileSync(file, lines.slice(start, end).join('\n'));
    console.log(`Wrote ${file}`);
  }
}

// I will do this manually for precision.
