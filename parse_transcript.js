const fs = require('fs');
const lines = fs.readFileSync('/home/anv/.gemini/antigravity/brain/593a86df-c0a2-4a6b-8000-486dfb6ac76c/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');

for (const line of lines) {
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      for (const call of obj.tool_calls) {
        if (call.name === 'view_file' && call.args && call.args.AbsolutePath && call.args.AbsolutePath.includes('app.js')) {
          // If we viewed app.js and got output...
        }
      }
    }
    if (obj.type === 'TOOL_RESPONSE' && obj.content && obj.content.includes('function renderDevices')) {
       fs.appendFileSync('old_app_parts.txt', obj.content + '\n---\n');
    }
  } catch (e) {}
}
