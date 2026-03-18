<script lang="ts">
  import { Thermometer, Target, Sparkles } from 'lucide-svelte';
  import type { SotItem } from '$lib/types/sot';

  interface Props {
    sot: SotItem;
  }

  let { sot }: Props = $props();

  const truncatedText = $derived(sot.text.length > 100 ? sot.text.slice(0, 100) + '...' : sot.text);

  const stageProgress = $derived([
    { key: 'generation', status: sot.stages.generation },
    { key: 'clustering', status: sot.stages.clustering },
    { key: 'intervention', status: sot.stages.intervention },
    { key: 'voting', status: sot.stages.voting },
  ]);

  function progressColor(status: string) {
    if (status === 'done') return 'bg-gradient-to-r from-green-500 to-emerald-600';
    if (status === 'running') return 'bg-gradient-to-r from-blue-500 to-cyan-500 animate-pulse';
    if (status === 'error') return 'bg-gradient-to-r from-red-500 to-rose-600';
    return 'bg-gray-300 dark:bg-gray-600';
  }
</script>

<div
  class="glass rounded-xl p-4 border transition-all duration-300 {sot.isInCentralCluster
    ? 'border-blue-400 dark:border-blue-500 shadow-lg shadow-blue-500/20'
    : 'border-gray-200/50 dark:border-gray-700/50'}"
>
  <!-- Header -->
  <div class="flex items-center justify-between mb-3">
    <div class="flex items-center gap-2">
      <div
        class="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center"
      >
        <Thermometer class="w-4 h-4 text-white" />
      </div>
      <div>
        <span class="text-sm font-bold text-gray-900 dark:text-white"
          >T={sot.temperature.toFixed(2)}</span
        >
        {#if sot.clusterId !== null}
          <span
            class="ml-2 text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
          >
            Cluster {sot.clusterId}
          </span>
        {/if}
      </div>
    </div>
    {#if sot.isInCentralCluster}
      <span
        class="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
      >
        <Target class="w-3 h-3" />
        Central
      </span>
    {/if}
  </div>

  <!-- SoT Text -->
  <div class="mb-3 p-2 rounded-lg bg-gray-100 dark:bg-gray-800/50">
    <p class="text-xs text-gray-700 dark:text-gray-300 font-mono leading-relaxed">
      {truncatedText}
    </p>
  </div>

  <!-- Progress Bar (4 segments) -->
  <div class="flex gap-1 mb-3">
    {#each stageProgress as stage}
      <div class="flex-1 h-1.5 rounded-full {progressColor(stage.status)}"></div>
    {/each}
  </div>

  <!-- Causal Metrics -->
  <div class="grid grid-cols-2 gap-2 text-xs">
    <div class="flex items-center gap-1.5 p-2 rounded-lg bg-gray-100 dark:bg-gray-800/50">
      <Sparkles class="w-3 h-3 text-purple-500" />
      <span class="text-gray-600 dark:text-gray-400">P(r|X):</span>
      <span class="font-semibold text-gray-900 dark:text-white">
        {sot.pRgivenX !== null ? (sot.pRgivenX * 100).toFixed(1) + '%' : '—'}
      </span>
    </div>
    {#if sot.isInCentralCluster}
      <div class="flex items-center gap-1.5 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
        <Target class="w-3 h-3 text-blue-500" />
        <span class="text-gray-600 dark:text-gray-400">P(A|do(r)):</span>
        <span class="font-semibold text-blue-700 dark:text-blue-300">
          {sot.pAgivenDoR !== null ? (sot.pAgivenDoR * 100).toFixed(1) + '%' : '—'}
        </span>
      </div>
    {:else}
      <div
        class="flex items-center gap-1.5 p-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 opacity-50"
      >
        <Target class="w-3 h-3 text-gray-400" />
        <span class="text-gray-500">P(A|do(r)): N/A</span>
      </div>
    {/if}
  </div>
</div>
