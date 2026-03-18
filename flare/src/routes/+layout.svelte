<script lang="ts">
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/theme';
  import '../app.css';

  let { children } = $props();

  onMount(() => {
    theme.init();
  });
</script>

<svelte:head>
  <link rel="icon" href="/favicon.svg" />
</svelte:head>

{@render children()}
