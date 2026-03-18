<script lang="ts">
  import { ChevronLeft, PlayCircle, StopCircle, FlaskConical, Trophy } from 'lucide-svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import SotStepper from '$lib/components/sot/SotStepper.svelte';
  import SotCard from '$lib/components/sot/SotCard.svelte';
  import type { SotStageStatus, SotItem, ClusterInfo, VotingResult } from '$lib/types/sot';
  import {
    generateSoT,
    embed,
    kMeans,
    interveneAndAnswer,
    aggregateVotes,
    sleep,
  } from '$lib/utils/sot-pipeline';

  // Pipeline configuration
  const TEMPERATURES = [0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const NUM_INTERVENTION_SAMPLES = 5;

  // UI State
  let question = $state('Natalia sold clips to 48 of her friends in April, and then she sold half as many clips in May. How many clips did Natalia sell altogether in April and May?');
  let isRunning = $state(false);

  // Pipeline stages
  let generationStatus: SotStageStatus = $state('idle');
  let clusteringStatus: SotStageStatus = $state('idle');
  let interventionStatus: SotStageStatus = $state('idle');
  let votingStatus: SotStageStatus = $state('idle');

  // Data
  let sots: SotItem[] = $state([]);
  let clusters: ClusterInfo[] = $state([]);
  let votingResults: VotingResult[] = $state([]);
  let finalAnswer: string | null = $state(null);
  let finalCausalWeight: number | null = $state(null);
  let errorMessage: string | null = $state(null);

  function createEmptySot(id: string, temperature: number): SotItem {
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
      totalSamples: 0,
      stages: {
        generation: 'idle',
        clustering: 'idle',
        intervention: 'idle',
        voting: 'idle',
      },
    };
  }

  function resetPipeline() {
    generationStatus = 'idle';
    clusteringStatus = 'idle';
    interventionStatus = 'idle';
    votingStatus = 'idle';
    sots = [];
    clusters = [];
    votingResults = [];
    finalAnswer = null;
    finalCausalWeight = null;
    errorMessage = null;
  }

  async function runPipeline() {
    if (!question.trim() || isRunning) return;

    isRunning = true;
    resetPipeline();

    try {
      // =====================
      // Stage 1: SoT Generation
      // =====================
      generationStatus = 'running';

      // Initialize SoT items
      sots = TEMPERATURES.map((temp, i) => createEmptySot(`sot-${i}`, temp));

      // Generate SoTs one by one with visual feedback
      for (let i = 0; i < sots.length; i++) {
        sots[i].stages.generation = 'running';
        sots = [...sots]; // Trigger reactivity

        // Use async LLM call for SoT generation
        const text = await generateSoT(question, sots[i].temperature);
        const embedding = embed(text);

        sots[i].text = text;
        sots[i].embedding = embedding;
        sots[i].stages.generation = 'done';
        sots = [...sots];
      }

      generationStatus = 'done';

      // =====================
      // Stage 2: Clustering
      // =====================
      clusteringStatus = 'running';

      // Mark all SoTs as clustering
      for (const sot of sots) {
        sot.stages.clustering = 'running';
      }
      sots = [...sots];

      await sleep(300);

      const embeddings = sots.map((s) => s.embedding);
      const m = sots.length;
      const k = Math.max(2, Math.floor(Math.sqrt(m)));

      const { assignments } = kMeans(embeddings, k);

      // Count cluster sizes
      const clusterSizes = new Map<number, number>();
      for (const clusterId of assignments) {
        clusterSizes.set(clusterId, (clusterSizes.get(clusterId) || 0) + 1);
      }

      // Find central cluster (largest)
      let centralClusterId = 0;
      let maxSize = 0;
      for (const [clusterId, size] of clusterSizes) {
        if (size > maxSize) {
          maxSize = size;
          centralClusterId = clusterId;
        }
      }

      // Build cluster info with SoT IDs
      const clusterSotIds = new Map<number, string[]>();
      for (let i = 0; i < sots.length; i++) {
        const clusterId = assignments[i];
        const existing = clusterSotIds.get(clusterId) ?? [];
        existing.push(sots[i].id);
        clusterSotIds.set(clusterId, existing);
      }

      clusters = Array.from(clusterSizes.entries()).map(([id, size]) => ({
        id,
        size,
        totalSots: m,
        pRgivenX: size / m,
        isCentral: id === centralClusterId,
        sotIds: clusterSotIds.get(id) ?? [],
        dominantAnswer: null,
        pAgivenDoR: null,
      }));

      // Update SoTs with cluster assignments and P(r|X)
      for (let i = 0; i < sots.length; i++) {
        const clusterId = assignments[i];
        const clusterInfo = clusters.find((c) => c.id === clusterId);
        sots[i].clusterId = clusterId;
        sots[i].isInCentralCluster = clusterId === centralClusterId;
        sots[i].pRgivenX = clusterInfo?.pRgivenX ?? 0;
        sots[i].stages.clustering = 'done';
      }
      sots = [...sots];

      clusteringStatus = 'done';

      // =====================
      // Stage 3: Intervention
      // =====================
      interventionStatus = 'running';

      // Only intervene on central cluster SoTs
      for (const sot of sots) {
        if (sot.isInCentralCluster) {
          sot.stages.intervention = 'running';
        } else {
          sot.stages.intervention = 'done'; // Skip non-central
        }
      }
      sots = [...sots];

      // Perform interventions using LLM to solve the problem
      for (const sot of sots) {
        if (!sot.isInCentralCluster) continue;

        // Call LLM to solve the problem with this SoT as guidance
        const { answers, correctCount, mostCommonAnswer } = await interveneAndAnswer(
          question,
          sot.text,
          NUM_INTERVENTION_SAMPLES
        );
        sot.answers = answers;
        sot.correctCount = correctCount;
        sot.mostCommonAnswer = mostCommonAnswer;
        sot.totalSamples = NUM_INTERVENTION_SAMPLES;
        sot.pAgivenDoR = answers.length > 0 ? correctCount / answers.length : 0;
        sot.stages.intervention = 'done';
        sots = [...sots];
      }

      interventionStatus = 'done';

      // Update cluster info with dominant answers and P(A|do(r))
      for (const cluster of clusters) {
        const clusterSots = sots.filter((s) => s.clusterId === cluster.id && s.isInCentralCluster);
        if (clusterSots.length > 0) {
          // Find dominant answer in this cluster
          const answerCounts = new Map<string, { count: number; totalPAgivenDoR: number }>();
          for (const s of clusterSots) {
            if (s.mostCommonAnswer) {
              const existing = answerCounts.get(s.mostCommonAnswer) ?? {
                count: 0,
                totalPAgivenDoR: 0,
              };
              existing.count++;
              existing.totalPAgivenDoR += s.pAgivenDoR ?? 0;
              answerCounts.set(s.mostCommonAnswer, existing);
            }
          }
          let maxCount = 0;
          for (const [answer, data] of answerCounts) {
            if (data.count > maxCount) {
              maxCount = data.count;
              cluster.dominantAnswer = answer;
              cluster.pAgivenDoR = data.totalPAgivenDoR / data.count;
            }
          }
        }
      }
      clusters = [...clusters];

      // =====================
      // Stage 4: Voting
      // =====================
      votingStatus = 'running';

      for (const sot of sots) {
        sot.stages.voting = 'running';
      }
      sots = [...sots];

      await sleep(200);

      // Aggregate votes with causal weighting
      votingResults = aggregateVotes(
        sots.map((s) => ({
          id: s.id,
          pRgivenX: s.pRgivenX ?? 0,
          pAgivenDoR: s.pAgivenDoR,
          mostCommonAnswer: s.mostCommonAnswer,
          isInCentralCluster: s.isInCentralCluster,
          clusterId: s.clusterId,
        }))
      );

      // Determine final answer
      if (votingResults.length > 0) {
        finalAnswer = votingResults[0].answer;
        finalCausalWeight = votingResults[0].causalWeight;
      }

      for (const sot of sots) {
        sot.stages.voting = 'done';
      }
      sots = [...sots];

      votingStatus = 'done';
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Pipeline failed';
      if (generationStatus === 'running') generationStatus = 'error';
      if (clusteringStatus === 'running') clusteringStatus = 'error';
      if (interventionStatus === 'running') interventionStatus = 'error';
      if (votingStatus === 'running') votingStatus = 'error';
    } finally {
      isRunning = false;
    }
  }

  function stopPipeline() {
    isRunning = false;
    // In a real implementation, we'd cancel ongoing API calls
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !isRunning) {
      e.preventDefault();
      runPipeline();
    }
  }
</script>

<div class="min-h-screen relative">
  <!-- Animated background -->
  <div class="fixed inset-0 -z-10">
    <div
      class="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-500/5 to-purple-500/10 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-500/5"
    ></div>
    <div class="absolute inset-0 grid-pattern opacity-20"></div>
  </div>

  <!-- Header -->
  <header
    class="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-gray-200/50 dark:border-gray-700/50"
  >
    <div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center gap-4">
          <a href="/" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <ChevronLeft class="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <div
              class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50"
            >
              <FlaskConical class="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 class="text-xl font-bold gradient-text">Debiasing Lens</h1>
              <p class="text-xs text-gray-500 dark:text-gray-400">Causal Prompting Experiment</p>
            </div>
          </a>
        </div>

        <div class="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </div>
    </div>
  </header>

  <!-- Main content -->
  <main class="pt-24 pb-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-screen-2xl mx-auto">
      <!-- Input Section -->
      <div class="mb-6">
        <div class="glass rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
          <div class="flex flex-col md:flex-row gap-4">
            <div class="flex-1">
              <label
                for="question"
                class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Question
              </label>
              <input
                type="text"
                id="question"
                bind:value={question}
                onkeydown={handleKeydown}
                placeholder="Enter a question for the causal prompting experiment..."
                class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                disabled={isRunning}
              />
            </div>
            <div class="flex items-end gap-2">
              {#if isRunning}
                <button
                  onclick={stopPipeline}
                  class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white font-semibold shadow-lg shadow-red-500/50 hover:shadow-xl transition-all"
                >
                  <StopCircle class="w-5 h-5" />
                  Stop
                </button>
              {:else}
                <button
                  onclick={runPipeline}
                  disabled={!question.trim()}
                  class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold shadow-lg shadow-purple-500/50 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlayCircle class="w-5 h-5" />
                  Run Pipeline
                </button>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Stepper -->
      <div class="mb-6">
        <SotStepper
          generation={generationStatus}
          clustering={clusteringStatus}
          intervention={interventionStatus}
          voting={votingStatus}
        />
      </div>

      <!-- Error Message -->
      {#if errorMessage}
        <div
          class="mb-6 p-4 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
        >
          <p class="font-semibold">Error</p>
          <p class="text-sm">{errorMessage}</p>
        </div>
      {/if}

      <!-- Final Answer -->
      {#if finalAnswer !== null}
        <div class="mb-6">
          <div
            class="glass-strong rounded-2xl p-8 border border-green-300 dark:border-green-700 text-center"
          >
            <div class="flex items-center justify-center gap-3 mb-4">
              <Trophy class="w-8 h-8 text-yellow-500" />
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Final Answer</h2>
            </div>
            <p class="text-5xl font-bold gradient-text mb-4">{finalAnswer}</p>
            <div class="flex items-center justify-center gap-2">
              <span class="text-sm text-gray-600 dark:text-gray-400">Causal Weight:</span>
              <span
                class="text-lg font-bold px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
              >
                {finalCausalWeight !== null ? finalCausalWeight.toFixed(4) : '—'}
              </span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Voting Results with Calculations -->
      {#if votingResults.length > 0}
        <div class="mb-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Weighted Voting and Final Answer
          </h3>
          <div class="glass rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Each cluster's answer is assigned a probability weight. The final answer is determined
              by summing these weights and selecting the answer with the highest total.
            </p>
            <div class="space-y-3">
              {#each votingResults as result, i}
                <div
                  class="p-4 rounded-xl border {i === 0
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'}"
                >
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-3">
                      <span class="text-2xl font-bold text-gray-900 dark:text-white"
                        >{result.answer}</span
                      >
                      {#if i === 0}
                        <span
                          class="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          >Winner</span
                        >
                      {/if}
                    </div>
                    <span class="text-lg font-bold text-purple-600 dark:text-purple-400">
                      {result.causalWeight.toFixed(4)}
                    </span>
                  </div>
                  <div
                    class="text-sm font-mono bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <span class="text-gray-500">P(A={result.answer}|do(X)) = </span>
                    <span class="text-blue-600 dark:text-blue-400">{result.calculation}</span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Contributors: {result.contributingSots.join(', ')}
                  </p>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      <!-- Detailed Cluster Reasoning Paths -->
      {#if clusters.length > 0}
        <div class="mb-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Cluster Reasoning Paths
          </h3>
          <div class="space-y-4">
            {#each clusters as cluster}
              <div
                class="glass rounded-2xl p-5 border {cluster.isCentral
                  ? 'border-blue-400 dark:border-blue-500 shadow-lg shadow-blue-500/20'
                  : 'border-gray-200/50 dark:border-gray-700/50'}"
              >
                <!-- Cluster Header -->
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold"
                    >
                      C{cluster.id}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-gray-900 dark:text-white"
                          >Cluster {cluster.id}</span
                        >
                        {#if cluster.isCentral}
                          <span
                            class="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          >
                            Central Cluster
                          </span>
                        {/if}
                      </div>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {cluster.sotIds.length} reasoning path(s)
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Cluster Metrics -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                    <p class="text-xs text-gray-500 dark:text-gray-400">Size</p>
                    <p class="font-mono font-bold text-gray-900 dark:text-white">
                      |C{cluster.id}| = {cluster.size}
                    </p>
                  </div>
                  <div class="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                    <p class="text-xs text-gray-500 dark:text-gray-400">P(r{cluster.id}|do(X))</p>
                    <p class="font-mono font-bold text-purple-700 dark:text-purple-300">
                      {cluster.size}/{cluster.totalSots} = {cluster.pRgivenX.toFixed(3)}
                    </p>
                  </div>
                  {#if cluster.isCentral && cluster.dominantAnswer}
                    <div class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        P(A={cluster.dominantAnswer}|do(r{cluster.id}))
                      </p>
                      <p class="font-mono font-bold text-blue-700 dark:text-blue-300">
                        {cluster.pAgivenDoR !== null ? cluster.pAgivenDoR.toFixed(3) : '—'}
                      </p>
                    </div>
                    <div class="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <p class="text-xs text-gray-500 dark:text-gray-400">Dominant Answer</p>
                      <p class="font-mono font-bold text-green-700 dark:text-green-300">
                        {cluster.dominantAnswer}
                      </p>
                    </div>
                  {:else}
                    <div
                      class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50 col-span-2 opacity-50"
                    >
                      <p class="text-xs text-gray-500">Not in central cluster - no intervention</p>
                    </div>
                  {/if}
                </div>

                <!-- Reasoning Paths in this Cluster -->
                <div class="space-y-2">
                  <p
                    class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide"
                  >
                    Reasoning Paths:
                  </p>
                  {#each sots.filter((s) => s.clusterId === cluster.id) as sot}
                    <div
                      class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700"
                    >
                      <div class="flex items-center justify-between mb-2">
                        <span
                          class="text-xs font-semibold px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                        >
                          T={sot.temperature.toFixed(2)}
                        </span>
                        {#if sot.isInCentralCluster && sot.mostCommonAnswer}
                          <span class="text-xs font-mono text-blue-600 dark:text-blue-400">
                            → {sot.mostCommonAnswer}
                          </span>
                        {/if}
                      </div>
                      <p class="text-xs text-gray-700 dark:text-gray-300 font-mono leading-relaxed">
                        {sot.text}
                      </p>
                      {#if sot.isInCentralCluster && sot.pAgivenDoR !== null}
                        <div
                          class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500"
                        >
                          P(A|do(r)) = {sot.correctCount}/{sot.answers.length} = {sot.pAgivenDoR.toFixed(
                            3
                          )}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- SoT Cards Grid -->
      {#if sots.length > 0}
        <div>
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Sketch-of-Thoughts ({sots.length})
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each sots as sot (sot.id)}
              <SotCard {sot} />
            {/each}
          </div>
        </div>
      {/if}

      <!-- Empty State -->
      {#if sots.length === 0 && !isRunning}
        <div class="text-center py-16">
          <div
            class="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-500/50"
          >
            <FlaskConical class="w-10 h-10 text-white" />
          </div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Causal Prompting Experiment
          </h2>
          <p class="text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-6">
            Enter a question above and click "Run Pipeline" to start the experiment. The visualizer
            will generate Sketch-of-Thoughts at different temperatures, cluster them, perform causal
            interventions, and aggregate results via weighted voting.
          </p>
          <div class="flex flex-wrap justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-gradient-to-br from-orange-400 to-red-500"></div>
              <span>9 temperature samples (0.0 - 2.0)</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-gradient-to-br from-purple-500 to-pink-500"></div>
              <span>k-means clustering</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500"></div>
              <span>Causal intervention</span>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </main>
</div>
