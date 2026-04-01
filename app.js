class SearchStrategy {
  search(text, pattern) { throw new Error('Not implemented'); }
  getSteps(text, pattern) { throw new Error('Not implemented'); }
  getName() { throw new Error('Not implemented'); }
  getKey() { throw new Error('Not implemented'); }
  getComplexity() { throw new Error('Not implemented'); }
}

class NaiveSearch extends SearchStrategy {
  getName() { return 'Naive (Força Bruta)'; }
  getKey() { return 'naive'; }
  getComplexity() {
    return { best: 'O(n)', average: 'O(n·m)', worst: 'O(n·m)', space: 'O(1)' };
  }

  search(text, pattern) {
    const n = text.length, m = pattern.length;
    const matches = [], start = performance.now();
    let comparisons = 0;
    for (let i = 0; i <= n - m; i++) {
      let j = 0;
      while (j < m) {
        comparisons++;
        if (text[i + j] !== pattern[j]) break;
        j++;
      }
      if (j === m) matches.push(i);
    }
    return { matches, comparisons, time: performance.now() - start };
  }

  getSteps(text, pattern) {
    const steps = [], n = text.length, m = pattern.length;
    for (let i = 0; i <= n - m; i++) {
      for (let j = 0; j < m; j++) {
        const match = text[i + j] === pattern[j];
        steps.push({ type: 'comparison', textIndex: i + j, patternIndex: j, windowStart: i, match,
          description: `Comparando text[${i+j}] = '${esc(text[i+j])}' com pattern[${j}] = '${esc(pattern[j])}' → ${match ? '✓ match' : '✗ mismatch'}` });
        if (!match) break;
        if (j === m - 1) {
          steps.push({ type: 'found', windowStart: i,
            description: `✓ PADRÃO ENCONTRADO na posição ${i}!` });
        }
      }
    }
    if (steps.length === 0) steps.push({ type: 'nomatch', description: 'Padrão não encontrado no texto.' });
    return steps;
  }
}

class RabinKarpSearch extends SearchStrategy {
  getName() { return 'Rabin-Karp'; }
  getKey() { return 'rk'; }
  getComplexity() {
    return { best: 'O(n+m)', average: 'O(n+m)', worst: 'O(n·m)', space: 'O(1)' };
  }

  _hash(text, start, len, d, q) {
    let h = 0;
    for (let i = start; i < start + len; i++) h = (d * h + text.charCodeAt(i)) % q;
    return h;
  }

  search(text, pattern) {
    const n = text.length, m = pattern.length;
    const d = 256, q = 101;
    const matches = [], start = performance.now();
    let comparisons = 0;
    if (m > n) return { matches, comparisons, time: 0 };
    let h = 1;
    for (let i = 0; i < m - 1; i++) h = (h * d) % q;
    let p = 0, t = 0;
    for (let i = 0; i < m; i++) {
      p = (d * p + pattern.charCodeAt(i)) % q;
      t = (d * t + text.charCodeAt(i)) % q;
    }
    for (let i = 0; i <= n - m; i++) {
      if (p === t) {
        let j = 0;
        while (j < m) { comparisons++; if (text[i+j] !== pattern[j]) break; j++; }
        if (j === m) matches.push(i);
      }
      if (i < n - m) {
        t = (d * (t - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % q;
        if (t < 0) t += q;
      }
    }
    return { matches, comparisons, time: performance.now() - start };
  }

  getSteps(text, pattern) {
    const steps = [], n = text.length, m = pattern.length;
    const d = 256, q = 101;
    if (m > n) return [{ type: 'nomatch', description: 'Padrão maior que o texto.' }];
    let h = 1;
    for (let i = 0; i < m - 1; i++) h = (h * d) % q;
    let p = 0, t = 0;
    for (let i = 0; i < m; i++) {
      p = (d * p + pattern.charCodeAt(i)) % q;
      t = (d * t + text.charCodeAt(i)) % q;
    }
    steps.push({ type: 'hash_init', patternHash: p, windowHash: t, windowStart: 0,
      description: `Inicialização: hash(padrão)=${p} | hash(janela[0..${m-1}])=${t} | d=256, q=101` });
    for (let i = 0; i <= n - m; i++) {
      const hm = p === t;
      steps.push({ type: 'hash_check', windowStart: i, patternHash: p, windowHash: t, hashMatch: hm,
        description: `Janela [${i}..${i+m-1}]: hash=${t} vs hash_padrão=${p} → ${hm ? '⚡ POSSÍVEL MATCH — verificar caracteres' : '✗ hashes diferentes, pular'}` });
      if (hm) {
        let j = 0;
        while (j < m) {
          const match = text[i+j] === pattern[j];
          steps.push({ type: 'comparison', textIndex: i+j, patternIndex: j, windowStart: i, match,
            description: `Verificação char: text[${i+j}]='${esc(text[i+j])}' vs pattern[${j}]='${esc(pattern[j])}' → ${match ? '✓' : '✗ falso positivo!'}` });
          if (!match) break;
          if (j === m - 1) steps.push({ type: 'found', windowStart: i, description: `✓ PADRÃO ENCONTRADO na posição ${i}!` });
          j++;
        }
      }
      if (i < n - m) {
        t = (d * (t - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % q;
        if (t < 0) t += q;
        steps.push({ type: 'roll_hash', windowStart: i+1, windowHash: t, patternHash: p,
          description: `Rolling hash: remove text[${i}]='${esc(text[i])}', adiciona text[${i+m}]='${esc(text[i+m])}' → novo hash=${t}` });
      }
    }
    return steps;
  }
}

class KMPSearch extends SearchStrategy {
  getName() { return 'Knuth-Morris-Pratt (KMP)'; }
  getKey() { return 'kmp'; }
  getComplexity() {
    return { best: 'O(n)', average: 'O(n+m)', worst: 'O(n+m)', space: 'O(m)' };
  }

  buildLPS(pattern) {
    const m = pattern.length, lps = new Array(m).fill(0);
    let len = 0, i = 1;
    while (i < m) {
      if (pattern[i] === pattern[len]) { lps[i++] = ++len; }
      else if (len > 0) { len = lps[len - 1]; }
      else { lps[i++] = 0; }
    }
    return lps;
  }

  search(text, pattern) {
    const n = text.length, m = pattern.length;
    const lps = this.buildLPS(pattern);
    const matches = [], start = performance.now();
    let comparisons = 0, i = 0, j = 0;
    while (i < n) {
      comparisons++;
      if (text[i] === pattern[j]) {
        i++; j++;
        if (j === m) { matches.push(i - j); j = lps[j - 1]; }
      } else {
        if (j > 0) j = lps[j - 1]; else i++;
      }
    }
    return { matches, comparisons, time: performance.now() - start };
  }

  getSteps(text, pattern) {
    const steps = [], n = text.length, m = pattern.length;
    const lps = this.buildLPS(pattern);
    steps.push({ type: 'lps_table', lps: [...lps], pattern,
      description: `Tabela LPS construída: [${lps.join(', ')}] — indica o maior prefixo próprio que é sufixo` });
    let i = 0, j = 0;
    while (i < n) {
      const match = text[i] === pattern[j];
      steps.push({ type: 'comparison', textIndex: i, patternIndex: j, windowStart: i - j, match, lps: [...lps],
        description: `text[${i}]='${esc(text[i])}' vs pattern[${j}]='${esc(pattern[j])}' → ${match ? '✓ match' : `✗ mismatch${j>0 ? `, j = lps[${j-1}] = ${lps[j-1]}` : ', avança i'}`}` });
      if (match) {
        i++; j++;
        if (j === m) {
          steps.push({ type: 'found', windowStart: i - j, lps: [...lps],
            description: `✓ PADRÃO ENCONTRADO na posição ${i - j}! Retrocede: j = lps[${j-1}] = ${lps[j-1]}` });
          j = lps[j - 1];
        }
      } else {
        if (j > 0) j = lps[j - 1]; else i++;
      }
    }
    return steps;
  }
}

class BoyerMooreSearch extends SearchStrategy {
  getName() { return 'Boyer-Moore'; }
  getKey() { return 'bm'; }
  getComplexity() {
    return { best: 'O(n/m)', average: 'O(n/m)', worst: 'O(n·m)', space: 'O(σ)' };
  }

  buildBadChar(pattern) {
    const bc = {};
    for (let i = 0; i < pattern.length; i++) bc[pattern[i]] = i;
    return bc;
  }

  search(text, pattern) {
    const n = text.length, m = pattern.length;
    const bc = this.buildBadChar(pattern);
    const matches = [], start = performance.now();
    let comparisons = 0, s = 0;
    while (s <= n - m) {
      let j = m - 1;
      while (j >= 0) {
        comparisons++;
        if (pattern[j] !== text[s + j]) break;
        j--;
      }
      if (j < 0) {
        matches.push(s);
        s += (s + m < n) ? m - (bc[text[s + m]] ?? -1) : 1;
      } else {
        s += Math.max(1, j - (bc[text[s + j]] ?? -1));
      }
    }
    return { matches, comparisons, time: performance.now() - start };
  }

  getSteps(text, pattern) {
    const steps = [], n = text.length, m = pattern.length;
    const bc = this.buildBadChar(pattern);
    steps.push({ type: 'bad_char_table', table: {...bc}, pattern,
      description: `Tabela Bad Character: {${Object.entries(bc).map(([k,v])=>`'${esc(k)}'→${v}`).join(', ')}} — última ocorrência de cada char no padrão` });
    let s = 0;
    while (s <= n - m) {
      let j = m - 1;
      while (j >= 0) {
        const match = pattern[j] === text[s + j];
        steps.push({ type: 'comparison', textIndex: s+j, patternIndex: j, windowStart: s, match, table: {...bc},
          description: `Direita→Esquerda: text[${s+j}]='${esc(text[s+j])}' vs pattern[${j}]='${esc(pattern[j])}' → ${match ? '✓' : '✗'}` });
        if (!match) break;
        j--;
      }
      if (j < 0) {
        steps.push({ type: 'found', windowStart: s, table: {...bc},
          description: `✓ PADRÃO ENCONTRADO na posição ${s}!` });
        s += (s + m < n) ? m - (bc[text[s + m]] ?? -1) : 1;
      } else {
        const bcVal = bc[text[s + j]] ?? -1;
        const shift = Math.max(1, j - bcVal);
        steps.push({ type: 'shift', windowStart: s, shift, mismatchChar: text[s+j], bcVal, j, table: {...bc},
          description: `Mismatch em '${esc(text[s+j])}': bad_char='${esc(text[s+j])}'→${bcVal} | shift = max(1, ${j}-${bcVal}) = ${shift}` });
        s += shift;
      }
    }
    return steps;
  }
}

class SearchContext {
  constructor() {
    this.strategies = {
      naive: new NaiveSearch(),
      rk: new RabinKarpSearch(),
      kmp: new KMPSearch(),
      bm: new BoyerMooreSearch()
    };
    this.current = this.strategies.naive;
  }
  setStrategy(key) { this.current = this.strategies[key]; }
  run(text, pattern) { return this.current.search(text, pattern); }
  steps(text, pattern) { return this.current.getSteps(text, pattern); }
  runAll(text, pattern) {
    return Object.entries(this.strategies).map(([key, s]) => ({
      key, name: s.getName(), ...s.search(text, pattern), matches: s.search(text, pattern).matches
    }));
  }
}

const ctx = new SearchContext();
let currentAlgo = 'naive';
let currentSteps = [];
let currentStepIdx = 0;
let autoplayTimer = null;
let lastResult = null;
let loadedFiles = {};
let compareCache = null;
let lastCompareText = '';
let lastComparePattern = '';

function esc(ch) {
  if (ch === ' ') return '·';
  if (ch === '\n') return '↵';
  if (ch === '\t') return '→';
  return ch || '';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
}

function updateComplexityRef(algo) {
  const s = ctx.strategies[algo];
  const c = s.getComplexity();
  document.getElementById('complexityRef').innerHTML = `
    <div style="color:var(--text-dim)">Algoritmo: <span style="color:var(--green)">${s.getName()}</span></div>
    <div>Melhor caso: <span style="color:var(--blue)">${c.best}</span></div>
    <div>Caso médio: <span style="color:var(--amber)">${c.average}</span></div>
    <div>Pior caso: <span style="color:var(--red)">${c.worst}</span></div>
    <div>Espaço: <span style="color:var(--purple)">${c.space}</span></div>
  `;
}

const MAX_VIZ = 200;

function renderTextChars(text, step, patLen) {
  const container = document.getElementById('textChars');
  const label = document.getElementById('textLengthLabel');
  label.textContent = `(${text.length} caracteres)`;
  container.innerHTML = '';

  let focusIdx = step ? (step.textIndex !== undefined ? step.textIndex : (step.windowStart !== undefined ? step.windowStart + Math.floor(patLen/2) : 0)) : 0;
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
      const inWin = (i >= ws && i < ws + patLen);
      if (inWin) box.classList.add('in-window');
      if (step.textIndex === i) {
        box.classList.add(step.match ? 'match' : 'mismatch');
        box.classList.add('current');
      }
      if (step.type === 'found' && i >= ws && i < ws + patLen) {
        box.classList.add('found-pos');
      }
    }

    const cv = document.createElement('span'); cv.className = 'char-val'; cv.textContent = esc(text[i]);
    const ci = document.createElement('span'); ci.className = 'char-idx'; ci.textContent = i;
    box.appendChild(cv); box.appendChild(ci);
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
    const cv = document.createElement('span'); cv.className = 'char-val'; cv.textContent = esc(pattern[j]);
    const ci = document.createElement('span'); ci.className = 'char-idx'; ci.textContent = j;
    box.appendChild(cv); box.appendChild(ci);
    container.appendChild(box);
  }
}

function renderAuxStructure(step) {
  const aux = document.getElementById('auxSection');
  aux.innerHTML = '';
  if (!step) return;

  if (step.lps) {
    const div = document.createElement('div'); div.className = 'aux-section';
    div.innerHTML = `<div class="aux-title">Tabela LPS (KMP)</div>`;
    const table = document.createElement('div'); table.className = 'lps-table';
    step.lps.forEach((v, i) => {
      const cell = document.createElement('div'); cell.className = 'table-cell';
      cell.innerHTML = `<span class="cell-key">${esc(currentPattern[i]) || i}</span><span class="cell-val">${v}</span>`;
      table.appendChild(cell);
    });
    div.appendChild(table);
    aux.appendChild(div);
  }

  if (step.table && (currentAlgo === 'bm')) {
    const div = document.createElement('div'); div.className = 'aux-section';
    div.innerHTML = `<div class="aux-title">Tabela Bad Character (Boyer-Moore)</div>`;
    const table = document.createElement('div'); table.className = 'bad-char-table';
    Object.entries(step.table).forEach(([k, v]) => {
      const cell = document.createElement('div'); cell.className = 'table-cell';
      cell.innerHTML = `<span class="cell-key">'${esc(k)}'</span><span class="cell-val">${v}</span>`;
      table.appendChild(cell);
    });
    div.appendChild(table);
    aux.appendChild(div);
  }

  if (step.type === 'hash_check' || step.type === 'hash_init' || step.type === 'roll_hash') {
    const div = document.createElement('div'); div.className = 'aux-section';
    div.innerHTML = `<div class="aux-title">Hashes (Rabin-Karp)</div>`;
    const hd = document.createElement('div'); hd.className = 'hash-display';
    const h1 = document.createElement('div'); h1.className = 'hash-item';
    h1.innerHTML = `<div class="hash-label">Hash do Padrão</div><div class="hash-val">${step.patternHash}</div>`;
    const h2 = document.createElement('div'); h2.className = `hash-item${step.hashMatch ? ' match-hash' : ''}`;
    h2.innerHTML = `<div class="hash-label">Hash da Janela</div><div class="hash-val">${step.windowHash}</div>`;
    hd.appendChild(h1); hd.appendChild(h2);
    div.appendChild(hd);
    aux.appendChild(div);
  }

  if (step.type === 'shift') {
    const div = document.createElement('div'); div.className = 'aux-section';
    div.innerHTML = `<div class="aux-title">Salto Boyer-Moore</div>
      <div style="font-size:12px;color:var(--amber)">Caractere mismatch: '<b>${esc(step.mismatchChar)}</b>' | 
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

let currentText = '', currentPattern = '';

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
    d.textContent = `[${i+1}] ${s.description}`;
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
    const list = document.createElement('div'); list.className = 'matches-list';
    matches.forEach(pos => {
      const b = document.createElement('div'); b.className = 'match-badge';
      b.textContent = `pos ${pos}`;
      list.appendChild(b);
    });
    sec.appendChild(list);
  }
}

function benchmarkTime(strategy, text, pattern) {
  const BATCHES = 3;
  const RUNS_PER_BATCH = Math.max(50, Math.ceil(5000 / Math.max(text.length, 1)));
  const times = [];
  
  for (let b = 0; b < BATCHES; b++) {
    const t0 = performance.now();
    for (let i = 0; i < RUNS_PER_BATCH; i++) strategy.search(text, pattern);
    const elapsed = performance.now() - t0;
    times.push(elapsed / RUNS_PER_BATCH);
  }
  
  times.sort((a, b) => a - b);
  const medianMs = times[Math.floor(times.length / 2)];
  return medianMs * 1000;
}

function renderMetrics(result, text, pattern, algoName) {
  const grid = document.getElementById('metricsGrid');
  const tbody = document.getElementById('complexityTableBody');
  document.getElementById('metricsEmpty').style.display = 'none';
  document.getElementById('metricsContent').style.display = 'block';

  const timeUs = benchmarkTime(ctx.strategies[currentAlgo], text, pattern);
  const timeLabel = timeUs < 1000
    ? `${timeUs.toFixed(2)}<span style="font-size:12px"> µs</span>`
    : `${(timeUs/1000).toFixed(3)}<span style="font-size:12px"> ms</span>`;

  grid.innerHTML = `
    <div class="metric-card">
      <div class="metric-val">${result.matches.length}</div>
      <div class="metric-label">Ocorrências</div>
    </div>
    <div class="metric-card">
      <div class="metric-val">${result.comparisons}</div>
      <div class="metric-label">Comparações</div>
    </div>
    <div class="metric-card">
      <div class="metric-val">${timeLabel}</div>
      <div class="metric-label">Tempo médio</div>
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

  const complexities = [
    { key: 'naive', name: 'Naive', best: 'O(n)', avg: 'O(n·m)', worst: 'O(n·m)', space: 'O(1)' },
    { key: 'rk', name: 'Rabin-Karp', best: 'O(n+m)', avg: 'O(n+m)', worst: 'O(n·m)', space: 'O(1)' },
    { key: 'kmp', name: 'KMP', best: 'O(n)', avg: 'O(n+m)', worst: 'O(n+m)', space: 'O(m)' },
    { key: 'bm', name: 'Boyer-Moore', best: 'O(n/m)', avg: 'O(n/m)', worst: 'O(n·m)', space: 'O(σ)' },
  ];
  tbody.innerHTML = complexities.map(c => `
    <tr class="${c.key === currentAlgo ? 'highlight-row' : ''}">
      <td>${c.name}${c.key === currentAlgo ? ' <span class="badge badge-green">atual</span>' : ''}</td>
      <td><span class="badge badge-green">${c.best}</span></td>
      <td><span class="badge badge-amber">${c.avg}</span></td>
      <td><span class="badge badge-red">${c.worst}</span></td>
      <td><span class="badge badge-blue">${c.space}</span></td>
    </tr>
  `).join('');
}

function renderCompare(results) {
  document.getElementById('compareEmpty').style.display = 'none';
  document.getElementById('compareContent').style.display = 'block';

  const minComps = Math.min(...results.map(r => r.comparisons));
  const maxComps = Math.max(...results.map(r => r.comparisons)) || 1;
  const maxTimeUs = Math.max(...results.map(r => r.timeUs)) || 1;

  const colors = { naive: '#ff4d6a', rk: '#4dc8ff', kmp: '#00e87a', bm: '#b06bff' };

  const grid = document.getElementById('compareGrid');
  grid.innerHTML = results.map(r => `
    <div class="compare-card ${r.comparisons === minComps ? 'winner' : ''}">
      <div class="cc-name">${r.name} ${r.comparisons === minComps ? '🏆' : ''}</div>
      <div class="cc-time" style="color:${colors[r.key]}">${r.timeUs < 1000 ? r.timeUs.toFixed(2) : (r.timeUs/1000).toFixed(3)}<span style="font-size:12px"> ${r.timeUs < 1000 ? 'µs' : 'ms'}</span></div>
      <div class="cc-comps">${r.comparisons} comparações</div>
      <div class="cc-matches">${r.matches.length} ocorrência(s)</div>
    </div>
  `).join('');

  const compChart = document.getElementById('comparisonsChart');
  compChart.innerHTML = results.map(r => `
    <div class="bar-row">
      <div class="bar-label">${r.name}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(3, (r.comparisons/maxComps)*100)}%;background:${colors[r.key]}22;border-left:3px solid ${colors[r.key]}">
          <span class="bar-val" style="color:${colors[r.key]}">${r.comparisons}</span>
        </div>
      </div>
    </div>
  `).join('');

  const timeChart = document.getElementById('timeChart');
  timeChart.innerHTML = results.map(r => `
    <div class="bar-row">
      <div class="bar-label">${r.name}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(3, (r.timeUs/maxTimeUs)*100)}%;background:${colors[r.key]}22;border-left:3px solid ${colors[r.key]}">
          <span class="bar-val" style="color:${colors[r.key]}">${r.timeUs < 1000 ? r.timeUs.toFixed(2) + ' µs' : (r.timeUs/1000).toFixed(3) + ' ms'}</span>
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

function runSearch() {
  const { text, pattern } = getInputs();
  if (!validateInputs(text, pattern)) return;
  currentText = text; currentPattern = pattern;
  ctx.setStrategy(currentAlgo);

  const result = ctx.run(text, pattern);
  lastResult = result;

  document.getElementById('vizEmpty').style.display = 'none';
  document.getElementById('stepControls').style.display = 'none';
  document.getElementById('textVizSection').style.display = 'block';
  stopAutoplay();

  renderTextChars(text, null, pattern.length);
  renderPatternChars(pattern, null);
  document.getElementById('auxSection').innerHTML = '';
  renderMatches(result.matches, text, pattern);

  renderAllMatchesInText(text, result.matches, pattern.length);

  const stepDesc = document.getElementById('stepDesc');
  stepDesc.style.display = 'none';
  buildLog(ctx.steps(text, pattern));

  renderMetrics(result, text, pattern, ctx.current.getName());
  showToast(`✓ ${result.matches.length} ocorrência(s) | ${result.comparisons} comparações`);
}

function renderAllMatchesInText(text, matches, patLen) {
  const container = document.getElementById('textChars');
  const label = document.getElementById('textLengthLabel');
  label.textContent = `(${text.length} caracteres)`;
  container.innerHTML = '';

  const matchSet = new Set();
  matches.forEach(pos => { for (let k = 0; k < patLen; k++) matchSet.add(pos + k); });

  let start = 0, end = Math.min(text.length, MAX_VIZ);

  if (start > 0) {
    const el = document.createElement('span');
    el.style.cssText = 'font-size:11px;color:var(--text-dim);padding:4px 6px;align-self:flex-end';
    el.textContent = `…[${start}]`;
    container.appendChild(el);
  }

  for (let i = start; i < end; i++) {
    const box = document.createElement('div');
    box.className = 'char-box';
    if (matchSet.has(i)) box.classList.add('found-pos');
    const cv = document.createElement('span'); cv.className = 'char-val'; cv.textContent = esc(text[i]);
    const ci = document.createElement('span'); ci.className = 'char-idx'; ci.textContent = i;
    box.appendChild(cv); box.appendChild(ci);
    container.appendChild(box);
  }

  if (end < text.length) {
    const el = document.createElement('span');
    el.style.cssText = 'font-size:11px;color:var(--text-dim);padding:4px 6px;align-self:flex-end';
    el.textContent = `[${end}]…`;
    container.appendChild(el);
  }
}

function runStepByStep() {
  const { text, pattern } = getInputs();
  if (!validateInputs(text, pattern)) return;
  currentText = text; currentPattern = pattern;
  ctx.setStrategy(currentAlgo);

  currentSteps = ctx.steps(text, pattern);
  currentStepIdx = 0;

  document.getElementById('vizEmpty').style.display = 'none';
  document.getElementById('stepControls').style.display = 'block';
  document.getElementById('textVizSection').style.display = 'block';
  document.getElementById('stepDesc').style.display = 'flex';

  buildLog(currentSteps);
  renderStep(0);
  showToast(`⏯ ${currentSteps.length} passos gerados`);
}

function stopAutoplay() {
  if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
  const btn = document.getElementById('btnAutoplay');
  if (btn) { btn.textContent = '▶ AUTO'; btn.classList.remove('playing'); }
}

function compareAll() {
  const { text, pattern } = getInputs();
  if (!validateInputs(text, pattern)) return;

  if (compareCache && lastCompareText === text && lastComparePattern === pattern) {
    renderCompare(compareCache);
    switchTab('compare');
    showToast('✓ Comparação (em cache)');
    return;
  }

  const results = Object.entries(ctx.strategies).map(([key, s]) => {
    const res = s.search(text, pattern);
    const timeUs = benchmarkTime(s, text, pattern);
    return { key, name: s.getName(), timeUs, comparisons: res.comparisons, matches: res.matches };
  });

  compareCache = results;
  lastCompareText = text;
  lastComparePattern = pattern;

  renderCompare(results);
  switchTab('compare');
  showToast('✓ Comparação concluída (valores podem variar por fatores do sistema)');
}

document.querySelectorAll('.algo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentAlgo = btn.dataset.algo;
    ctx.setStrategy(currentAlgo);
    updateComplexityRef(currentAlgo);
  });
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

document.getElementById('btnRun').addEventListener('click', runSearch);
document.getElementById('btnStep').addEventListener('click', runStepByStep);
document.getElementById('btnCompare').addEventListener('click', compareAll);

document.getElementById('btnFirst').addEventListener('click', () => {
  stopAutoplay(); currentStepIdx = 0; renderStep(0);
});
document.getElementById('btnPrev').addEventListener('click', () => {
  if (currentStepIdx > 0) { stopAutoplay(); currentStepIdx--; renderStep(currentStepIdx); }
});
document.getElementById('btnNext').addEventListener('click', () => {
  if (currentStepIdx < currentSteps.length - 1) { stopAutoplay(); currentStepIdx++; renderStep(currentStepIdx); }
});
document.getElementById('btnLast').addEventListener('click', () => {
  stopAutoplay(); currentStepIdx = currentSteps.length - 1; renderStep(currentStepIdx);
});

document.getElementById('btnAutoplay').addEventListener('click', () => {
  const btn = document.getElementById('btnAutoplay');
  if (autoplayTimer) {
    stopAutoplay();
  } else {
    btn.textContent = '⏸ PAUSAR'; btn.classList.add('playing');
    const speed = () => parseInt(document.getElementById('speedSlider').value);
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

document.getElementById('patternInput').addEventListener('input', function() {
  const p = this.value, t = document.getElementById('textInput').value;
  if (p && t) {
    const info = document.getElementById('patternInfo');
    info.textContent = `m=${p.length}, n=${t.length}, n·m=${t.length * p.length}`;
  }
});
document.getElementById('textInput').addEventListener('input', function() {
  document.getElementById('patternInput').dispatchEvent(new Event('input'));
});

const fileInput = document.getElementById('fileInput');
const fileDrop = document.getElementById('fileDrop');

fileInput.addEventListener('change', handleFiles);
fileDrop.addEventListener('dragover', e => { e.preventDefault(); fileDrop.classList.add('drag-over'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('drag-over'));
fileDrop.addEventListener('drop', e => {
  e.preventDefault(); fileDrop.classList.remove('drag-over');
  handleFileList(e.dataTransfer.files);
});

function handleFiles(e) { handleFileList(e.target.files); }

function handleFileList(files) {
  Array.from(files).forEach(file => {
    if (!file.name.endsWith('.txt')) { showToast(`⚠ ${file.name} não é .txt`); return; }
    const reader = new FileReader();
    reader.onload = e => {
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
  chips.innerHTML = Object.keys(loadedFiles).map(name => `
    <div class="file-chip">
      <span> ${name}</span>
      <span class="remove" onclick="removeFile('${name}')">✕</span>
    </div>
  `).join('');
}

function removeFile(name) {
  delete loadedFiles[name];
  updateFileChips();
  document.getElementById('textInput').value = Object.values(loadedFiles).join('\n');
}

updateComplexityRef('naive');
document.getElementById('patternInput').dispatchEvent(new Event('input'));
