const { exec } = require('child_process');
const serial = 'RFCY307M7CW';

async function testToggle(turnOff) {
  const key = turnOff ? 'alt+o' : 'shift+alt+o';
  const cmd = `xdotool search --name "Dex Mirror:" | head -n 1 | xargs -I {} xdotool key --window {} ${key}`;
  console.log('Running:', cmd);
  return new Promise((resolve) => {
    exec(cmd, (err, stdout) => {
      console.log('Error:', err);
      resolve();
    });
  });
}

(async () => {
  await testToggle(true); // turn off
  console.log('Turned off? Wait 3s...');
  await new Promise(r => setTimeout(r, 3000));
  await testToggle(false); // turn on
  console.log('Turned on?');
})();
