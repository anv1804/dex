import { state } from '../store.js';

const termEls = {
  targetSelect: document.getElementById('terminal-target'),
  output: document.getElementById('terminal-output'),
  input: document.getElementById('terminal-input'),
  prompt: document.getElementById('terminal-prompt'),
  btnClear: document.getElementById('btn-clear-terminal')
};

export function appendTerminal(text, type = 'normal') {
  if (!termEls.output) return;
  const div = document.createElement('div');
  div.className = type === 'cmd' ? 'cmd-line' : (type === 'error' ? 'error-line' : '');
  div.textContent = text;
  termEls.output.appendChild(div);
  termEls.output.scrollTop = termEls.output.scrollHeight;
}

export function updateTerminalDropdown() {
  if (!termEls.targetSelect) return;
  const currentTarget = termEls.targetSelect.value;
  
  Array.from(termEls.targetSelect.options).forEach(opt => {
    if (opt.value !== 'local') opt.remove();
  });

  state.devices.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.serial;
    opt.textContent = `📱 ${[d.manufacturer, d.model].filter(Boolean).join(' ') || 'Device'} (${d.serial})`;
    termEls.targetSelect.appendChild(opt);
  });

  if (Array.from(termEls.targetSelect.options).some(o => o.value === currentTarget)) {
    termEls.targetSelect.value = currentTarget;
  } else {
    termEls.targetSelect.value = 'local';
  }
  updateTerminalPrompt();
}

function updateTerminalPrompt() {
  if (!termEls.prompt || !termEls.targetSelect) return;
  const target = termEls.targetSelect.value;
  termEls.prompt.textContent = target === 'local' ? 'local$ ' : `${target}$ `;
}

export function initTerminal() {
  if (!termEls.input) return;
  
  termEls.targetSelect.addEventListener('change', updateTerminalPrompt);

  termEls.input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const cmd = termEls.input.value.trim();
      if (!cmd) return;
      
      termEls.input.value = '';
      const target = termEls.targetSelect.value;
      const promptTxt = target === 'local' ? 'local$' : `${target}$`;
      appendTerminal(`${promptTxt} ${cmd}`, 'cmd');

      try {
        const out = await window.dex.execTerminal(target, cmd);
        if (out) appendTerminal(out);
      } catch (err) {
        appendTerminal(err.message || String(err), 'error');
      }
    }
  });

  if (termEls.btnClear) {
    termEls.btnClear.addEventListener('click', () => {
      termEls.output.innerHTML = '';
    });
  }
}
