<script lang="ts">
  import { CheckCircle2, Clock, AlertTriangle, Sparkles, Grid3x3, Zap, Vote } from 'lucide-svelte';
  import type { SotStageStatus } from '$lib/types/sot';

  interface Props {
    generation: SotStageStatus;
    clustering: SotStageStatus;
    intervention: SotStageStatus;
    voting: SotStageStatus;
  }

  let { generation, clustering, intervention, voting }: Props = $props();

  function classes(status: SotStageStatus) {
    if (status === 'done') return 'bg-gradient-to-br from-green-500 to-emerald-600 text-white';
    if (status === 'running')
      return 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50';
    if (status === 'error') return 'bg-gradient-to-br from-red-500 to-rose-600 text-white';
    return 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  }

  function label(status: SotStageStatus) {
    if (status === 'done') return 'Done';
    if (status === 'running') return 'Running';
    if (status === 'error') return 'Error';
    return 'Idle';
  }

  function connectorClass(status: SotStageStatus) {
    if (status === 'done') return 'bg-gradient-to-r from-green-500 to-emerald-600';
    if (status === 'running') return 'bg-gradient-to-r from-blue-500 to-cyan-500';
    if (status === 'error') return 'bg-gradient-to-r from-red-500 to-rose-600';
    return 'bg-gray-300 dark:bg-gray-600';
  }

  const steps = $derived([
    { key: 'generation', status: generation, label: 'SoT Generation', icon: Sparkles },
    { key: 'clustering', status: clustering, label: 'Clustering', icon: Grid3x3 },
    { key: 'intervention', status: intervention, label: 'Intervention', icon: Zap },
    { key: 'voting', status: voting, label: 'Voting', icon: Vote },
  ]);
</script>

<div class="glass-strong rounded-2xl p-4">
  <div class="flex items-center gap-4 overflow-x-auto">
    {#each steps as step, i}
      <div class="flex items-center gap-3 min-w-max">
        <div class="w-12 h-12 rounded-full flex items-center justify-center {classes(step.status)}">
          {#if step.status === 'done'}
            <CheckCircle2 class="w-6 h-6" />
          {:else if step.status === 'error'}
            <AlertTriangle class="w-6 h-6" />
          {:else if step.status === 'running'}
            <Clock class="w-6 h-6 animate-pulse" />
          {:else}
            <step.icon class="w-5 h-5" />
          {/if}
        </div>
        <div>
          <p class="text-sm font-semibold">{step.label}</p>
          <p class="text-xs text-gray-600 dark:text-gray-400">{label(step.status)}</p>
        </div>
      </div>

      {#if i < steps.length - 1}
        <div class="h-1 w-8 rounded-full {connectorClass(steps[i + 1].status)}"></div>
      {/if}
    {/each}
  </div>
</div>
