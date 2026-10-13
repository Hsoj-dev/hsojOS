<!-- src\routes\projects\hsojOS\os\apps\Placeholder.svelte -->
<script lang="ts">
  let { label = "This app" }: { label?: string } = $props();
</script>

<div class="grid h-full place-items-center p-6 text-center">
    <div class="space-y-1">
        <p class="font-bold">{label}</p>
        <p class="text-sm text-base-content/60">Nothing here yet. Swap this component in apps.ts.</p>
    </div>
</div>