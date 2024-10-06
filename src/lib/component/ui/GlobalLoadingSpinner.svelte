<script lang="ts">
    import { isLoading } from '../../../stores/loading';
    import LoadingSpinner from './LoadingSpinner.svelte';
    import { fade, fly } from 'svelte/transition';
</script>

{#if $isLoading}
    <div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div in:fly="{{ y: 50, duration: 300 }}" out:fade="{{ duration: 200 }}">
            <LoadingSpinner />
        </div>
    </div>
{/if}