const logEls = {
  output: document.getElementById('logger-output'),
  btnClear: document.getElementById('btn-clear-logger'),
  filterLevel: document.getElementById('logger-filter-level')
};

let logs = [];
const MAX_LOGS = 1000;

function renderLogs() {
  if (!logEls.output) return;
  const filter = logEls.filterLevel ? logEls.filterLevel.value : 'all';
  
  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter);
  
  logEls.output.innerHTML = filtered.map(l => {
    return `<div class="log-line log-${l.level}">
      <span class="log-time">[${l.time}]</span> 
      <span class="log-msg">${l.msg}</span>
    </div>`;
  }).join('');
  
  logEls.output.scrollTop = logEls.output.scrollHeight;
}

export function initLogger() {
  if (logEls.btnClear) {
    logEls.btnClear.addEventListener('click', () => {
      logs = [];
      renderLogs();
    });
  }
  
  if (logEls.filterLevel) {
    logEls.filterLevel.addEventListener('change', renderLogs);
  }

  if (window.dex && window.dex.onLog) {
    window.dex.onLog((logData) => {
      logs.push(logData);
      if (logs.length > MAX_LOGS) logs.shift();
      
      const filter = logEls.filterLevel ? logEls.filterLevel.value : 'all';
      if (filter === 'all' || filter === logData.level) {
        if (logEls.output) {
          const div = document.createElement('div');
          div.className = `log-line log-${logData.level}`;
          div.innerHTML = `<span class="log-time">[${logData.time}]</span> <span class="log-msg">${logData.msg}</span>`;
          logEls.output.appendChild(div);
          logEls.output.scrollTop = logEls.output.scrollHeight;
        }
      }
    });
  }
}
