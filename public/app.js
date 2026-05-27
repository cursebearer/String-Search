/**
 * Frontend v2 — consome o backend Node (Express + OpenTelemetry).
 * Todas as buscas viram POST /api/* — cada request gera um trace no Jaeger
 * e atualiza metricas no Prometheus / Grafana.
 */

const API_BASE = (() => {
  // se rodando via http://localhost:3000, usa same-origin
  // se servido via outro host, ajuste manualmente
  return '';
})();

const algorithms = {
  naive:  { key: 'naive', name: 'NAIVE',        tag: 'O(n*m)' },
  rk:     { key: 'rk',    name: 'RABIN-KARP',   tag: 'O(n+m) avg' },
  kmp:    { key: 'kmp',   name: 'KMP',          tag: 'O(n+m)' },
  bm:     { key: 'bm',    name: 'BOYER-MOORE',  tag: 'O(n/m) best' },
};

const complexities = {
  naive: { best: 'O(n)',   average: 'O(n*m)', worst: 'O(n*m)', space: 'O(1)' },
  rk:    { best: 'O(n+m)', average: 'O(n+m)', worst: 'O(n*m)', space: 'O(1)' },
  kmp:   { best: 'O(n)',   average: 'O(n+m)', worst: 'O(n+m)', space: 'O(m)' },
  bm:    { best: 'O(n/m)', average: 'O(n/m)', worst: 'O(n*m)', space: 'O(σ)' },
};

let currentAlgo = 'naive';
let currentSteps = [];
let currentStepIdx = 0;
let autoplayTimer = null;
let lastResult = null;
let loadedFiles = {};
let compareCache = null;
let lastCompareText = '';
let lastComparePattern = '';
let currentText = '';
let currentPattern = '';

const MAX_VIZ = 200;

function esc(ch) {
  if (ch === ' ') return '·';
  if (ch === '\n') return '↵';
  if (ch === '\t') return '→';
  return ch || '';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.toggle('active', c.id === 'tab-' + tab));
}

function updateComplexityRef(algo) {
  const a = algorithms[algo];
  const c = complexities[algo];
  document.getElementById('complexityRef').innerHTML = `
    <div style="color:var(--text-dim)">Algoritmo: <span style="color:var(--green)">${a.name}</span></div>
    <div>Melhor caso: <span style="color:var(--blue)">${c.best}</span></div>
    <div>Caso médio: <span style="color:var(--amber)">${c.average}</span></div>
    <div>Pior caso: <span style="color:var(--red)">${c.worst}</span></div>
    <div>Espaço: <span style="color:var(--purple)">${c.space}</span></div>
  `;
}

async function api(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function checkHealth() {
  try {
    const r = await fetch(API_BASE + '/health');
    if (!r.ok) throw new Error('fail');
    document.getElementById('apiLabel').textContent = 'API ON';
    document.getElementById('apiDot').style.background = 'var(--green)';
  } catch {
    document.getElementById('apiLabel').textContent = 'API OFF';
    document.getElementById('apiDot').style.background = 'var(--red)';
  }
}

function renderTextChars(text, step, patLen) {
  const container = document.getElementById('textChars');
  const label = document.getElementById('textLengthLabel');
  label.textContent = `(${text.length} caracteres)`;
  container.innerHTML = '';

  let focusIdx = step
    ? step.textIndex !== undefined
      ? step.textIndex
      : step.windowStart !== undefined
        ? step.windowStart + Math.floor(patLen / 2)
        : 0
    : 0;
  let start = Math.max(0, focusIdx - 40);
  let end = Math.min(text.length, start + MAX_VIZ);
  if (end - start < MAX_VIZ && start > 0) start = Math.max(0, end - MAX_VIZ);

  if (start > 0) {
    const el = document.createElement('span');
    el.style.cssText = 'font-size:11px;color:var(--text-dim);padding:4px 6px;align-self:flex-end';
    el.textContent = `…[${start}]`;
    container.appendChild(el);
  }

  for (let i = start; i < end; i++) {
    const box = document.createElement('div');
    box.className = 'char-box';

    if (step) {
      const ws = step.windowStart !== undefined ? step.windowStart : -1;
      const inWin = i >= ws && i < ws + patLen;
      if (inWin) box.classList.add('in-window');
      if (step.textIndex === i) {
        box.classList.add(step.match ? 'match' : 'mismatch');
        box.classList.add('current');
      }
      if (step.type === 'found' && i >= ws && i < ws + patLen) {
        box.classList.add('found-pos');
      }
    }

    const cv = document.createElement('span');
    cv.className = 'char-val';
    cv.textContent = esc(text[i]);
    const ci = document.createElement('span');
    ci.className = 'char-idx';
    ci.textContent = i;
    box.appendChild(cv);
    box.appendChild(ci);
    container.appendChild(box);
  }

  if (end < text.length) {
    const el = document.createElement('span');
    el.style.cssText = 'font-size:11px;color:var(--text-dim);padding:4px 6px;align-self:flex-end';
    el.textContent = `[${end}]…`;
    container.appendChild(el);
  }
}

function renderPatternChars(pattern, step) {
  const container = document.getElementById('patternChars');
  const label = document.getElementById('patternLengthLabel');
  label.textContent = `(${pattern.length} caracteres)`;
  container.innerHTML = '';
  for (let j = 0; j < pattern.length; j++) {
    const box = document.createElement('div');
    box.className = 'pattern-char-box';
    if (step) {
      if (step.patternIndex === j) box.classList.add(step.match ? 'match' : 'mismatch');
      if (step.patternIndex === j) box.classList.add('current');
    }
    const cv = document.createElement('span');
    cv.className = 'char-val';
    cv.textContent = esc(pattern[j]);
    const ci = document.createElement('span');
    ci.className = 'char-idx';
    ci.textContent = j;
    box.appendChild(cv);
    box.appendChild(ci);
    container.appendChild(box);
  }
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function renderAuxStructure(step) {
  const aux = document.getElementById('auxSection');
  aux.innerHTML = '';
  if (!step) return;

  if (step.lps) {
    const div = document.createElement('div');
    div.className = 'aux-section';
    div.innerHTML = `<div class="aux-title">Tabela LPS (KMP)</div>`;
    const table = document.createElement('div');
    table.className = 'lps-table';
    step.lps.forEach((v, i) => {
      const cell = document.createElement('div');
      cell.className = 'table-cell';
      cell.innerHTML = `<span class="cell-key">${escHtml(esc(currentPattern[i]) || i)}</span><span class="cell-val">${v}</span>`;
      table.appendChild(cell);
    });
    div.appendChild(table);
    aux.appendChild(div);
  }

  if (step.table && currentAlgo === 'bm') {
    const div = document.createElement('div');
    div.className = 'aux-section';
    div.innerHTML = `<div class="aux-title">Tabela Bad Character (Boyer-Moore)</div>`;
    const table = document.createElement('div');
    table.className = 'bad-char-table';
    Object.entries(step.table).forEach(([k, v]) => {
      const cell = document.createElement('div');
      cell.className = 'table-cell';
      cell.innerHTML = `<span class="cell-key">'${escHtml(esc(k))}'</span><span class="cell-val">${v}</span>`;
      table.appendChild(cell);
    });
    div.appendChild(table);
    aux.appendChild(div);
  }

  if (step.type === 'hash_check' || step.type === 'hash_init' || step.type === 'roll_hash') {
    const div = document.createElement('div');
    div.className = 'aux-section';
    div.innerHTML = `<div class="aux-title">Hashes (Rabin-Karp)</div>`;
    const hd = document.createElement('div');
    hd.className = 'hash-display';
    const h1 = document.createElement('div');
    h1.className = 'hash-item';
    h1.innerHTML = `<div class="hash-label">Hash do Padrão</div><div class="hash-val">${step.patternHash}</div>`;
    const h2 = document.createElement('div');
    h2.className = `hash-item${step.hashMatch ? ' match-hash' : ''}`;
    h2.innerHTML = `<div class="hash-label">Hash da Janela</div><div class="hash-val">${step.windowHash}</div>`;
    hd.appendChild(h1);
    hd.appendChild(h2);
    div.appendChild(hd);
    aux.appendChild(div);
  }

  if (step.type === 'shift') {
    const div = document.createElement('div');
    div.className = 'aux-section';
    div.innerHTML = `<div class="aux-title">Salto Boyer-Moore</div>
      <div style="font-size:12px;color:var(--amber)">Caractere mismatch: '<b>${escHtml(esc(step.mismatchChar))}</b>' |
      bad_char[j=${step.j}] = ${step.bcVal} | <b>shift = ${step.shift}</b></div>`;
    aux.appendChild(div);
  }
}

function renderStepDesc(step) {
  const el = document.getElementById('stepDesc');
  el.className = 'step-desc';
  if (step.type === 'found') el.classList.add('found-desc');
  if (step.type === 'shift') el.classList.add('shift-desc');
  el.textContent = step.description;
}

function renderStep(idx) {
  const step = currentSteps[idx];
  if (!step) return;
  document.getElementById('stepCounter').textContent = `Passo ${idx + 1} / ${currentSteps.length}`;
  document.getElementById('btnFirst').disabled = idx === 0;
  document.getElementById('btnPrev').disabled = idx === 0;
  document.getElementById('btnNext').disabled = idx === currentSteps.length - 1;
  document.getElementById('btnLast').disabled = idx === currentSteps.length - 1;
  renderStepDesc(step);
  renderTextChars(currentText, step, currentPattern.length);
  renderPatternChars(currentPattern, step);
  renderAuxStructure(step);
}

function buildLog(steps) {
  const log = document.getElementById('logArea');
  log.innerHTML = '';
  const shown = steps.slice(0, 200);
  shown.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'log-line';
    if (s.type === 'found') d.classList.add('log-found');
    else if (s.type === 'shift') d.classList.add('log-shift');
    else if (s.type === 'hash_check' || s.type === 'hash_init' || s.type === 'roll_hash') d.classList.add('log-hash');
    else if (s.match) d.classList.add('log-match');
    d.textContent = `[${i + 1}] ${s.description}`;
    log.appendChild(d);
  });
  if (steps.length > 200) {
    const d = document.createElement('div');
    d.className = 'log-line';
    d.style.color = 'var(--text-dim)';
    d.textContent = `... (${steps.length - 200} passos omitidos)`;
    log.appendChild(d);
  }
}

function renderMatches(matches, text, pattern) {
  const sec = document.getElementById('matchesSection');
  sec.innerHTML = `<div class="matches-count">${matches.length > 0
    ? `<span>${matches.length}</span> ocorrência(s) encontrada(s)`
    : `<span class="no-result">Nenhuma</span> ocorrência encontrada`}
    <span style="color:var(--text-dim);font-size:10px;margin-left:8px">n=${text.length}, m=${pattern.length}</span>
  </div>`;
  if (matches.length > 0) {
    const list = document.createElement('div');
    list.className = 'matches-list';
    matches.slice(0, 200).forEach((pos) => {
      const b = document.createElement('div');
      b.className = 'match-badge';
      b.textContent = `pos ${pos}`;
      list.appendChild(b);
    });
    if (matches.length > 200) {
      const more = document.createElement('div');
      more.className = 'match-badge';
      more.style.background = 'transparent';
      more.style.borderColor = 'var(--border)';
      more.style.color = 'var(--text-dim)';
      more.textContent = `+${matches.length - 200} mais…`;
      list.appendChild(more);
    }
    sec.appendChild(list);
  }
}

function renderAllMatchesInText(text, matches, patLen) {
  const container = document.getElementById('textChars');
  const label = document.getElementById('textLengthLabel');
  label.textContent = `(${text.length} caracteres)`;
  container.innerHTML = '';

  const matchSet = new Set();
  matches.forEach((pos) => { for (let k = 0; k < patLen; k++) matchSet.add(pos + k); });

  let start = 0;
  let end = Math.min(text.length, MAX_VIZ);

  for (let i = start; i < end; i++) {
    const box = document.createElement('div');
    box.className = 'char-box';
    if (matchSet.has(i)) box.classList.add('found-pos');
    const cv = document.createElement('span');
    cv.className = 'char-val';
    cv.textContent = esc(text[i]);
    const ci = document.createElement('span');
    ci.className = 'char-idx';
    ci.textContent = i;
    box.appendChild(cv);
    box.appendChild(ci);
    container.appendChild(box);
  }

  if (end < text.length) {
    const el = document.createElement('span');
    el.style.cssText = 'font-size:11px;color:var(--text-dim);padding:4px 6px;align-self:flex-end';
    el.textContent = `[${end}]…`;
    container.appendChild(el);
  }
}

function renderMetrics(result, text, pattern) {
  const grid = document.getElementById('metricsGrid');
  const tbody = document.getElementById('complexityTableBody');
  document.getElementById('metricsEmpty').style.display = 'none';
  document.getElementById('metricsContent').style.display = 'block';

  const timeUs = result.durationUs;
  const timeLabel = timeUs < 1000
    ? `${timeUs.toFixed(2)}<span style="font-size:12px"> µs</span>`
    : `${(timeUs / 1000).toFixed(3)}<span style="font-size:12px"> ms</span>`;

  grid.innerHTML = `
    <div class="metric-card">
      <div class="metric-val">${result.matchCount}</div>
      <div class="metric-label">Ocorrências</div>
    </div>
    <div class="metric-card">
      <div class="metric-val">${result.comparisons}</div>
      <div class="metric-label">Comparações</div>
    </div>
    <div class="metric-card">
      <div class="metric-val">${timeLabel}</div>
      <div class="metric-label">Tempo (server-side)</div>
    </div>
    <div class="metric-card">
      <div class="metric-val">${text.length}</div>
      <div class="metric-label">Tamanho n (texto)</div>
    </div>
    <div class="metric-card">
      <div class="metric-val">${pattern.length}</div>
      <div class="metric-label">Tamanho m (padrão)</div>
    </div>
    <div class="metric-card">
      <div class="metric-val" style="font-size:14px">${text.length * pattern.length}</div>
      <div class="metric-label">n × m (Naive worst)</div>
    </div>
    <div class="metric-card">
      <div class="metric-val" style="font-size:14px">${text.length + pattern.length}</div>
      <div class="metric-label">n + m (KMP/RK)</div>
    </div>
    <div class="metric-card">
      <div class="metric-val" style="font-size:14px">${pattern.length > 0 ? Math.ceil(text.length / pattern.length) : '—'}</div>
      <div class="metric-label">n ÷ m (BM best)</div>
    </div>
  `;

  const rows = [
    { key: 'naive', name: 'Naive', ...complexities.naive },
    { key: 'rk', name: 'Rabin-Karp', ...complexities.rk },
    { key: 'kmp', name: 'KMP', ...complexities.kmp },
    { key: 'bm', name: 'Boyer-Moore', ...complexities.bm },
  ];
  tbody.innerHTML = rows.map((c) => `
    <tr class="${c.key === currentAlgo ? 'highlight-row' : ''}">
      <td>${c.name}${c.key === currentAlgo ? ' <span class="badge badge-green">atual</span>' : ''}</td>
      <td><span class="badge badge-green">${c.best}</span></td>
      <td><span class="badge badge-amber">${c.average}</span></td>
      <td><span class="badge badge-red">${c.worst}</span></td>
      <td><span class="badge badge-blue">${c.space}</span></td>
    </tr>
  `).join('');
}

function renderCompare(results) {
  document.getElementById('compareEmpty').style.display = 'none';
  document.getElementById('compareContent').style.display = 'block';

  const minComps = Math.min(...results.map((r) => r.comparisons));
  const maxComps = Math.max(...results.map((r) => r.comparisons)) || 1;
  const maxTimeUs = Math.max(...results.map((r) => r.durationUs)) || 1;

  const colors = { naive: '#ff4d6a', rk: '#4dc8ff', kmp: '#00e87a', bm: '#b06bff' };

  const grid = document.getElementById('compareGrid');
  grid.innerHTML = results.map((r) => `
    <div class="compare-card ${r.comparisons === minComps ? 'winner' : ''}">
      <div class="cc-name">${algorithms[r.algorithm].name} ${r.comparisons === minComps ? '🏆' : ''}</div>
      <div class="cc-time" style="color:${colors[r.algorithm]}">${r.durationUs < 1000 ? r.durationUs.toFixed(2) : (r.durationUs / 1000).toFixed(3)}<span style="font-size:12px"> ${r.durationUs < 1000 ? 'µs' : 'ms'}</span></div>
      <div class="cc-comps">${r.comparisons} comparações</div>
      <div class="cc-matches">${r.matchCount} ocorrência(s)</div>
    </div>
  `).join('');

  document.getElementById('comparisonsChart').innerHTML = results.map((r) => `
    <div class="bar-row">
      <div class="bar-label">${algorithms[r.algorithm].name}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(3, (r.comparisons / maxComps) * 100)}%;background:${colors[r.algorithm]}22;border-left:3px solid ${colors[r.algorithm]}">
          <span class="bar-val" style="color:${colors[r.algorithm]}">${r.comparisons}</span>
        </div>
      </div>
    </div>
  `).join('');

  document.getElementById('timeChart').innerHTML = results.map((r) => `
    <div class="bar-row">
      <div class="bar-label">${algorithms[r.algorithm].name}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(3, (r.durationUs / maxTimeUs) * 100)}%;background:${colors[r.algorithm]}22;border-left:3px solid ${colors[r.algorithm]}">
          <span class="bar-val" style="color:${colors[r.algorithm]}">${r.durationUs < 1000 ? r.durationUs.toFixed(2) + ' µs' : (r.durationUs / 1000).toFixed(3) + ' ms'}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function getInputs() {
  const text = document.getElementById('textInput').value;
  const pattern = document.getElementById('patternInput').value;
  return { text, pattern };
}

function validateInputs(text, pattern) {
  if (!text.trim()) { showToast('⚠ Insira um texto'); return false; }
  if (!pattern) { showToast('⚠ Insira um padrão de busca'); return false; }
  if (pattern.length > text.length) { showToast('⚠ Padrão maior que o texto'); return false; }
  return true;
}

async function runSearch() {
  const { text, pattern } = getInputs();
  if (!validateInputs(text, pattern)) return;
  currentText = text;
  currentPattern = pattern;

  try {
    const result = await api('/api/search', { text, pattern, algorithm: currentAlgo });
    lastResult = result;

    document.getElementById('vizEmpty').style.display = 'none';
    document.getElementById('stepControls').style.display = 'none';
    document.getElementById('textVizSection').style.display = 'block';
    stopAutoplay();

    renderAllMatchesInText(text, result.matches, pattern.length);
    renderPatternChars(pattern, null);
    document.getElementById('auxSection').innerHTML = '';
    renderMatches(result.matches, text, pattern);

    const stepDesc = document.getElementById('stepDesc');
    stepDesc.style.display = 'none';
    document.getElementById('logArea').innerHTML = '';

    renderMetrics(result, text, pattern);
    showToast(`✓ ${result.matchCount} ocorrência(s) | ${result.comparisons} comparações | ${result.durationMs.toFixed(2)}ms`);
  } catch (err) {
    showToast('✗ ' + err.message);
  }
}

async function runStepByStep() {
  const { text, pattern } = getInputs();
  if (!validateInputs(text, pattern)) return;
  currentText = text;
  currentPattern = pattern;

  try {
    const data = await api('/api/steps', { text, pattern, algorithm: currentAlgo });
    currentSteps = data.steps;
    currentStepIdx = 0;

    document.getElementById('vizEmpty').style.display = 'none';
    document.getElementById('stepControls').style.display = 'block';
    document.getElementById('textVizSection').style.display = 'block';
    document.getElementById('stepDesc').style.display = 'flex';

    buildLog(currentSteps);
    renderStep(0);
    showToast(`⏯ ${currentSteps.length} passos gerados`);
  } catch (err) {
    showToast('✗ ' + err.message);
  }
}

function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
  const btn = document.getElementById('btnAutoplay');
  if (btn) { btn.textContent = '▶ AUTO'; btn.classList.remove('playing'); }
}

async function compareAll() {
  const { text, pattern } = getInputs();
  if (!validateInputs(text, pattern)) return;

  if (compareCache && lastCompareText === text && lastComparePattern === pattern) {
    renderCompare(compareCache);
    switchTab('compare');
    showToast('✓ Comparação (em cache)');
    return;
  }

  try {
    const data = await api('/api/compare', { text, pattern });
    compareCache = data.results;
    lastCompareText = text;
    lastComparePattern = pattern;

    renderCompare(data.results);
    switchTab('compare');
    showToast('✓ Comparação concluída (' + data.results.length + ' algoritmos)');
  } catch (err) {
    showToast('✗ ' + err.message);
  }
}

document.querySelectorAll('.algo-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.algo-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentAlgo = btn.dataset.algo;
    updateComplexityRef(currentAlgo);
  });
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

document.getElementById('btnRun').addEventListener('click', runSearch);
document.getElementById('btnStep').addEventListener('click', runStepByStep);
document.getElementById('btnCompare').addEventListener('click', compareAll);

document.getElementById('btnFirst').addEventListener('click', () => {
  stopAutoplay();
  currentStepIdx = 0;
  renderStep(0);
});
document.getElementById('btnPrev').addEventListener('click', () => {
  if (currentStepIdx > 0) { stopAutoplay(); currentStepIdx--; renderStep(currentStepIdx); }
});
document.getElementById('btnNext').addEventListener('click', () => {
  if (currentStepIdx < currentSteps.length - 1) { stopAutoplay(); currentStepIdx++; renderStep(currentStepIdx); }
});
document.getElementById('btnLast').addEventListener('click', () => {
  stopAutoplay();
  currentStepIdx = currentSteps.length - 1;
  renderStep(currentStepIdx);
});

document.getElementById('btnAutoplay').addEventListener('click', () => {
  const btn = document.getElementById('btnAutoplay');
  if (autoplayTimer) {
    stopAutoplay();
  } else {
    btn.textContent = '⏸ PAUSAR';
    btn.classList.add('playing');
    const speed = () => parseInt(document.getElementById('speedSlider').value, 10);
    autoplayTimer = setInterval(() => {
      if (currentStepIdx >= currentSteps.length - 1) { stopAutoplay(); return; }
      currentStepIdx++;
      renderStep(currentStepIdx);
    }, speed());
  }
});

document.getElementById('speedSlider').addEventListener('input', () => {
  if (autoplayTimer) {
    stopAutoplay();
    document.getElementById('btnAutoplay').click();
  }
});

document.getElementById('patternInput').addEventListener('input', function () {
  const p = this.value;
  const t = document.getElementById('textInput').value;
  if (p && t) {
    document.getElementById('patternInfo').textContent = `m=${p.length}, n=${t.length}, n·m=${t.length * p.length}`;
  }
});
document.getElementById('textInput').addEventListener('input', () => {
  document.getElementById('patternInput').dispatchEvent(new Event('input'));
});

const fileInput = document.getElementById('fileInput');
const fileDrop = document.getElementById('fileDrop');

fileInput.addEventListener('change', (e) => handleFileList(e.target.files));
fileDrop.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('drag-over'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('drag-over'));
fileDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDrop.classList.remove('drag-over');
  handleFileList(e.dataTransfer.files);
});

function handleFileList(files) {
  Array.from(files).forEach((file) => {
    if (!file.name.endsWith('.txt')) { showToast(`⚠ ${file.name} não é .txt`); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      loadedFiles[file.name] = e.target.result;
      updateFileChips();
      const existing = document.getElementById('textInput').value;
      document.getElementById('textInput').value = existing ? existing + '\n' + e.target.result : e.target.result;
      document.getElementById('patternInput').dispatchEvent(new Event('input'));
      showToast(`✓ ${file.name} carregado (${e.target.result.length} chars)`);
    };
    reader.readAsText(file);
  });
}

function updateFileChips() {
  const chips = document.getElementById('fileChips');
  chips.innerHTML = Object.keys(loadedFiles).map((name) => `
    <div class="file-chip">
      <span> ${escHtml(name)}</span>
      <span class="remove" data-file="${escHtml(name)}">✕</span>
    </div>
  `).join('');
  chips.querySelectorAll('.remove').forEach((el) => {
    el.addEventListener('click', () => removeFile(el.dataset.file));
  });
}

function removeFile(name) {
  delete loadedFiles[name];
  updateFileChips();
  document.getElementById('textInput').value = Object.values(loadedFiles).join('\n');
}

updateComplexityRef('naive');
document.getElementById('patternInput').dispatchEvent(new Event('input'));
checkHealth();
setInterval(checkHealth, 10000);
