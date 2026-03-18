const TEMPERATURES = [0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const NUM_INTERVENTION_SAMPLES = 5;

const el = {
  workerUrl: document.getElementById('workerUrl'),
  appToken: document.getElementById('appToken'),
  question: document.getElementById('question'),
  runBtn: document.getElementById('runBtn'),
  stopBtn: document.getElementById('stopBtn'),
  generationStatus: document.getElementById('generationStatus'),
  clusteringStatus: document.getElementById('clusteringStatus'),
  interventionStatus: document.getElementById('interventionStatus'),
  votingStatus: document.getElementById('votingStatus'),
  errorBox: document.getElementById('errorBox'),
  resultSection: document.getElementById('resultSection'),
  finalAnswer: document.getElementById('finalAnswer'),
  finalWeight: document.getElementById('finalWeight'),
  votingList: document.getElementById('votingList'),
  clusterList: document.getElementById('clusterList'),
  sotList: document.getElementById('sotList')
};

const state = {
  isRunning: false,
  runToken: 0,
  sots: [],
  clusters: [],
  votingResults: [],
  finalAnswer: null,
  finalCausalWeight: null
};

function loadSavedConfig() {
  el.workerUrl.value = localStorage.getItem('debias.workerUrl') || '';
  el.appToken.value = localStorage.getItem('debias.appToken') || '';
}

function persistConfig() {
  localStorage.setItem('debias.workerUrl', el.workerUrl.value.trim());
  localStorage.setItem('debias.appToken', el.appToken.value);
}

function setStatus(node, status) {
  node.textContent = status;
  node.className = 'status-pill inline-block mt-2 px-2 py-1 rounded-full text-xs font-semibold';
  if (status === 'running') node.classList.add('bg-blue-100', 'text-blue-700');
  else if (status === 'done') node.classList.add('bg-green-100', 'text-green-700');
  else if (status === 'error') node.classList.add('bg-red-100', 'text-red-700');
  else node.classList.add('bg-gray-100', 'text-gray-700');
}

function setAllStatus(generation, clustering, intervention, voting) {
  setStatus(el.generationStatus, generation);
  setStatus(el.clusteringStatus, clustering);
  setStatus(el.interventionStatus, intervention);
  setStatus(el.votingStatus, voting);
}

function resetView() {
  state.sots = [];
  state.clusters = [];
  state.votingResults = [];
  state.finalAnswer = null;
  state.finalCausalWeight = null;
  setAllStatus('idle', 'idle', 'idle', 'idle');
  el.errorBox.classList.add('hidden');
  el.errorBox.textContent = '';
  el.resultSection.classList.add('hidden');
  el.finalAnswer.textContent = '-';
  el.finalWeight.textContent = '-';
  renderVoting();
  renderClusters();
  renderSots();
}

function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/chat') ? trimmed : `${trimmed.replace(/\/$/, '')}/chat`;
}

function assertRun(token) {
  if (!state.isRunning || token !== state.runToken) {
    throw new Error('Pipeline stopped');
  }
}

async function callChatAPI(prompt, systemPrompt, token) {
  assertRun(token);
  const workerUrl = normalizeUrl(el.workerUrl.value);
  if (!workerUrl) {
    throw new Error('Worker URL is required');
  }

  const headers = { 'Content-Type': 'application/json' };
  const appToken = el.appToken.value;
  if (appToken) headers['X-App-Token'] = appToken;

  const res = await fetch(workerUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: prompt,
      options: systemPrompt ? { systemPrompt } : {}
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text || 'Unknown error'}`);
  }

  return (await res.text()).trim();
}

async function generateSoT(question, temperature, token) {
  const systemPrompt =
    'You are a math problem solver. Create a brief 2-3 sentence reasoning sketch: key numbers, operations, and logical steps.';
  const prompt = `Create a brief reasoning sketch for this problem:\n\n"${question}"\n\nSketch of Thought:`;
  const response = await callChatAPI(prompt, systemPrompt, token);
  return `[T=${temperature.toFixed(2)}] ${response}`;
}

function embed(text) {
  const dims = 8;
  const out = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const idx = i % dims;
    out[idx] += Math.sin(charCode * 0.1) * Math.cos(i * 0.05);
  }
  const mag = Math.sqrt(out.reduce((sum, v) => sum + v * v, 0)) || 1;
  return out.map((v) => v / mag);
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function kMeans(points, k, maxIterations = 20) {
  const n = points.length;
  const dims = points[0]?.length || 0;
  if (!n || !dims) return { assignments: [], centroids: [] };

  const centroids = points.slice(0, k).map((p) => [...p]);
  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    const next = [];
    for (const point of points) {
      let min = Infinity;
      let best = 0;
      for (let c = 0; c < k; c++) {
        const d = euclideanDistance(point, centroids[c]);
        if (d < min) {
          min = d;
          best = c;
        }
      }
      next.push(best);
    }

    const changed = next.some((v, i) => v !== assignments[i]);
    assignments = next;
    if (!changed) break;

    for (let c = 0; c < k; c++) {
      const clusterPoints = points.filter((_, i) => assignments[i] === c);
      if (clusterPoints.length) {
        for (let d = 0; d < dims; d++) {
          centroids[c][d] =
            clusterPoints.reduce((sum, p) => sum + p[d], 0) / clusterPoints.length;
        }
      }
    }
  }

  return { assignments, centroids };
}

function extractNumericAnswer(response) {
  const patterns = [
    /####\s*(\d+(?:\.\d+)?)/i,
    /(?:final\s+)?answer[:\s]+(?:is\s+)?(\d+(?:\.\d+)?)/i,
    /(?:total|altogether|sum)[:\s]+(?:is\s+)?(\d+(?:\.\d+)?)/i,
    /=\s*(\d+(?:\.\d+)?)\s*$/m,
    /(\d+(?:\.\d+)?)\s*$/i
  ];

  for (const p of patterns) {
    const m = response.match(p);
    if (m) return m[1];
  }
  const nums = response.match(/\d+(?:\.\d+)?/g);
  return nums && nums.length ? nums[nums.length - 1] : null;
}

async function interveneAndAnswer(question, sot, numSamples, token) {
  const answers = [];
  const systemPrompt =
    'You are an expert math problem solver. Solve step by step and always end with: #### [number]';
  const prompt =
    `Solve this math word problem step by step.\n\nUse this reasoning approach as a guide: ${sot}\n\nProblem: "${question}"\n\nEnd with #### followed by only the numeric answer.`;

  for (let i = 0; i < numSamples; i++) {
    assertRun(token);
    try {
      const response = await callChatAPI(prompt, systemPrompt, token);
      const answer = extractNumericAnswer(response);
      if (answer) answers.push(answer);
    } catch {
      // Ignore sample failure and continue.
    }
  }

  const counts = new Map();
  for (const ans of answers) counts.set(ans, (counts.get(ans) || 0) + 1);

  let mostCommonAnswer = '';
  let maxCount = 0;
  for (const [ans, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonAnswer = ans;
    }
  }

  return {
    answers,
    correctCount: maxCount,
    mostCommonAnswer
  };
}

function aggregateVotes(sots) {
  const voteMap = new Map();

  for (const sot of sots) {
    if (!sot.isInCentralCluster || sot.pAgivenDoR == null || !sot.mostCommonAnswer) continue;

    const causalWeight = sot.pRgivenX * sot.pAgivenDoR;
    const term = `${sot.pRgivenX.toFixed(3)} x ${sot.pAgivenDoR.toFixed(3)}`;

    const prev = voteMap.get(sot.mostCommonAnswer) || {
      weight: 0,
      contributors: [],
      terms: []
    };

    prev.weight += causalWeight;
    prev.contributors.push(sot.id);
    prev.terms.push(term);
    voteMap.set(sot.mostCommonAnswer, prev);
  }

  return Array.from(voteMap.entries())
    .map(([answer, data]) => ({
      answer,
      causalWeight: data.weight,
      contributingSots: data.contributors,
      calculation: `${data.terms.join(' + ')} = ${data.weight.toFixed(4)}`
    }))
    .sort((a, b) => b.causalWeight - a.causalWeight);
}

function renderVoting() {
  if (!state.votingResults.length) {
    el.votingList.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No results yet.</p>';
    return;
  }

  el.votingList.innerHTML = state.votingResults
    .map((item, index) => {
      const winner = index === 0
        ? '<span class="ml-2 inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">winner</span>'
        : '';
      return `
        <div class="p-3 rounded-lg border ${index === 0 ? 'border-green-300 bg-green-50/60' : 'border-gray-200 dark:border-gray-700'}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="font-semibold text-lg">${item.answer}${winner}</div>
            <div class="font-bold text-purple-700">${item.causalWeight.toFixed(4)}</div>
          </div>
          <p class="text-xs mt-2 text-gray-600 dark:text-gray-400">P(A|do(X)) = ${item.calculation}</p>
          <p class="text-xs mt-1 text-gray-600 dark:text-gray-400">Contributors: ${item.contributingSots.join(', ')}</p>
        </div>
      `;
    })
    .join('');
}

function renderClusters() {
  if (!state.clusters.length) {
    el.clusterList.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No clusters yet.</p>';
    return;
  }

  el.clusterList.innerHTML = state.clusters
    .map((c) => `
      <div class="p-3 rounded-lg border ${c.isCentral ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200 dark:border-gray-700'}">
        <div class="font-semibold">Cluster ${c.id} ${c.isCentral ? '(central)' : ''}</div>
        <p class="text-xs mt-1">size=${c.size}/${c.totalSots}, P(r|X)=${c.pRgivenX.toFixed(3)}</p>
        <p class="text-xs mt-1">dominant=${c.dominantAnswer || '-'}, P(A|do(r))=${c.pAgivenDoR == null ? '-' : c.pAgivenDoR.toFixed(3)}</p>
        <p class="text-xs mt-1">SoTs: ${c.sotIds.join(', ')}</p>
      </div>
    `)
    .join('');
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderSots() {
  if (!state.sots.length) {
    el.sotList.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No reasoning paths yet.</p>';
    return;
  }

  el.sotList.innerHTML = state.sots
    .map((s) => `
      <div class="p-3 rounded-lg border ${s.isInCentralCluster ? 'border-indigo-300 bg-indigo-50/60' : 'border-gray-200 dark:border-gray-700'}">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-semibold">${s.id} [T=${s.temperature.toFixed(2)}]</div>
          <div class="text-xs">cluster=${s.clusterId == null ? '-' : s.clusterId} ${s.isInCentralCluster ? '(central)' : ''}</div>
        </div>
        <p class="text-xs mt-1 text-gray-600 dark:text-gray-400">P(r|X)=${s.pRgivenX == null ? '-' : s.pRgivenX.toFixed(3)}, P(A|do(r))=${s.pAgivenDoR == null ? '-' : s.pAgivenDoR.toFixed(3)}</p>
        <p class="mt-2 text-sm whitespace-pre-wrap">${escapeHtml(s.text || '(pending)')}</p>
        <p class="text-xs mt-2 text-gray-600 dark:text-gray-400">mostCommonAnswer=${s.mostCommonAnswer || '-'}</p>
      </div>
    `)
    .join('');
}

function setRunningUI(running) {
  state.isRunning = running;
  el.runBtn.disabled = running;
  el.stopBtn.disabled = !running;
  el.runBtn.classList.toggle('opacity-60', running);
}

function showError(message) {
  el.errorBox.textContent = message;
  el.errorBox.classList.remove('hidden');
}

function createEmptySot(id, temperature) {
  return {
    id,
    temperature,
    text: '',
    embedding: [],
    clusterId: null,
    isInCentralCluster: false,
    pRgivenX: null,
    pAgivenDoR: null,
    answers: [],
    mostCommonAnswer: '',
    correctCount: 0,
    totalSamples: 0
  };
}

async function runPipeline() {
  const question = el.question.value.trim();
  if (!question || state.isRunning) return;

  persistConfig();
  resetView();

  const token = ++state.runToken;
  setRunningUI(true);

  try {
    setStatus(el.generationStatus, 'running');
    state.sots = TEMPERATURES.map((temp, i) => createEmptySot(`sot-${i}`, temp));
    renderSots();

    for (let i = 0; i < state.sots.length; i++) {
      assertRun(token);
      const sot = state.sots[i];
      sot.text = await generateSoT(question, sot.temperature, token);
      sot.embedding = embed(sot.text);
      renderSots();
    }
    setStatus(el.generationStatus, 'done');

    setStatus(el.clusteringStatus, 'running');
    const embeddings = state.sots.map((s) => s.embedding);
    const m = state.sots.length;
    const k = Math.max(2, Math.floor(Math.sqrt(m)));
    const { assignments } = kMeans(embeddings, k);

    const clusterSizes = new Map();
    for (const clusterId of assignments) {
      clusterSizes.set(clusterId, (clusterSizes.get(clusterId) || 0) + 1);
    }

    let centralClusterId = 0;
    let maxSize = 0;
    for (const [clusterId, size] of clusterSizes.entries()) {
      if (size > maxSize) {
        maxSize = size;
        centralClusterId = clusterId;
      }
    }

    const clusterSotIds = new Map();
    for (let i = 0; i < state.sots.length; i++) {
      const cid = assignments[i];
      const list = clusterSotIds.get(cid) || [];
      list.push(state.sots[i].id);
      clusterSotIds.set(cid, list);
    }

    state.clusters = Array.from(clusterSizes.entries()).map(([id, size]) => ({
      id,
      size,
      totalSots: m,
      pRgivenX: size / m,
      isCentral: id === centralClusterId,
      sotIds: clusterSotIds.get(id) || [],
      dominantAnswer: null,
      pAgivenDoR: null
    }));

    for (let i = 0; i < state.sots.length; i++) {
      const cid = assignments[i];
      const info = state.clusters.find((c) => c.id === cid);
      state.sots[i].clusterId = cid;
      state.sots[i].isInCentralCluster = cid === centralClusterId;
      state.sots[i].pRgivenX = info ? info.pRgivenX : 0;
    }

    renderSots();
    renderClusters();
    setStatus(el.clusteringStatus, 'done');

    setStatus(el.interventionStatus, 'running');
    for (const sot of state.sots) {
      assertRun(token);
      if (!sot.isInCentralCluster) continue;
      const { answers, correctCount, mostCommonAnswer } = await interveneAndAnswer(
        question,
        sot.text,
        NUM_INTERVENTION_SAMPLES,
        token
      );
      sot.answers = answers;
      sot.correctCount = correctCount;
      sot.mostCommonAnswer = mostCommonAnswer;
      sot.totalSamples = NUM_INTERVENTION_SAMPLES;
      sot.pAgivenDoR = answers.length ? correctCount / answers.length : 0;
      renderSots();
    }

    for (const cluster of state.clusters) {
      const clusterSots = state.sots.filter((s) => s.clusterId === cluster.id && s.isInCentralCluster);
      if (!clusterSots.length) continue;

      const answerCounts = new Map();
      for (const s of clusterSots) {
        if (!s.mostCommonAnswer) continue;
        const prev = answerCounts.get(s.mostCommonAnswer) || { count: 0, totalP: 0 };
        prev.count += 1;
        prev.totalP += s.pAgivenDoR || 0;
        answerCounts.set(s.mostCommonAnswer, prev);
      }

      let maxCount2 = 0;
      for (const [answer, data] of answerCounts.entries()) {
        if (data.count > maxCount2) {
          maxCount2 = data.count;
          cluster.dominantAnswer = answer;
          cluster.pAgivenDoR = data.totalP / data.count;
        }
      }
    }

    renderClusters();
    setStatus(el.interventionStatus, 'done');

    setStatus(el.votingStatus, 'running');
    state.votingResults = aggregateVotes(
      state.sots.map((s) => ({
        id: s.id,
        pRgivenX: s.pRgivenX || 0,
        pAgivenDoR: s.pAgivenDoR,
        mostCommonAnswer: s.mostCommonAnswer,
        isInCentralCluster: s.isInCentralCluster,
        clusterId: s.clusterId
      }))
    );

    if (state.votingResults.length) {
      state.finalAnswer = state.votingResults[0].answer;
      state.finalCausalWeight = state.votingResults[0].causalWeight;
      el.resultSection.classList.remove('hidden');
      el.finalAnswer.textContent = state.finalAnswer;
      el.finalWeight.textContent = state.finalCausalWeight.toFixed(4);
    }

    renderVoting();
    setStatus(el.votingStatus, 'done');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Pipeline failed';
    showError(msg === 'Pipeline stopped' ? 'Pipeline stopped by user.' : msg);
    if (el.generationStatus.textContent === 'running') setStatus(el.generationStatus, 'error');
    if (el.clusteringStatus.textContent === 'running') setStatus(el.clusteringStatus, 'error');
    if (el.interventionStatus.textContent === 'running') setStatus(el.interventionStatus, 'error');
    if (el.votingStatus.textContent === 'running') setStatus(el.votingStatus, 'error');
  } finally {
    setRunningUI(false);
  }
}

function stopPipeline() {
  state.runToken += 1;
  setRunningUI(false);
}

el.runBtn.addEventListener('click', runPipeline);
el.stopBtn.addEventListener('click', stopPipeline);
el.question.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    runPipeline();
  }
});
el.workerUrl.addEventListener('change', persistConfig);
el.appToken.addEventListener('change', persistConfig);

loadSavedConfig();
resetView();
