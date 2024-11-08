<script lang="ts">
    import type { ChangeEventHandler } from "svelte/elements";

    export let label: string = '';
    export let checked: boolean = false;
    export let onChange: ChangeEventHandler<HTMLInputElement> | null = null;
    export let title = '';
</script>

<div class="flex items-center gap-3" {title}>
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}"
        on:click={() => {
            checked = !checked;
            if (onChange) onChange(new Event('change'));
        }}
    >
        <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            class:translate-x-5={checked}
            class:translate-x-0={!checked}
        />
    </button>
    {#if label}
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    {/if}
    <slot />
</div>