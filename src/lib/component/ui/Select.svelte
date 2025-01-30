<script context="module" lang="ts">
	export type SelectOption = {
		id: string | number;
		name: string;
	};
</script>

<script lang="ts">
	export let options: SelectOption[] = [];
	export let value: string | number;
	export let onchange: (value: string | number) => void = () => {};
	export let label = '';
</script>

<div class="relative inline-block w-full min-w-[200px]">
	{#if label}
		<label for="select-{label}" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
	{/if}
	<select
		id="select-{label}"
		bind:value
		class="appearance-none w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
		on:change={() => onchange(value)}
	>
		{#each options as option}
			<option value={option.id}>{option.name}</option>
		{/each}
	</select>
	<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
		<svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
			<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
		</svg>
	</div>
</div>