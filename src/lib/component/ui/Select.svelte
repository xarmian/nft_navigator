<script context="module" lang="ts">
	export type SelectOption = {
		id: string | number;
		name: string;
		imageUrl?: string;
	};

	declare namespace svelteHTML {
		interface HTMLAttributes<T> {
			'on:clickoutside'?: (event: CustomEvent) => void;
		}
	}
</script>

<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { clickOutside } from '$lib/utils/clickOutside';

	export let options: SelectOption[] = [];
	export let value: string | number;
	export let onchange: (value: string | number) => void = () => {};
	export let label = '';
	export let searchable = false;
	export let searchText = '';
	
	let isOpen = false;
	let filteredOptions = options;

	// Filter options based on search text
	$: {
		if (searchable && searchText) {
			filteredOptions = options.filter(option => 
				option.name.toLowerCase().includes(searchText.toLowerCase()) ||
				option.id.toString().toLowerCase().includes(searchText.toLowerCase())
			);
		} else {
			filteredOptions = options;
		}
	}

	// Update search text when value changes
	$: if (value && value !== 0 && !searchText && !isOpen) {
		const selected = options.find(opt => opt.id === value);
		if (selected) {
			searchText = selected.name;
		}
	}

	function handleOptionSelect(option: SelectOption) {
		value = option.id;
		searchText = option.name;
		onchange(option.id);
		isOpen = false;
	}

	function handleClickOutside() {
		isOpen = false;
		if (value && value !== 0) {
			const selected = options.find(opt => opt.id === value);
			if (selected) {
				searchText = selected.name;
			}
		}
	}

	function clearSearch(event: MouseEvent) {
		event.stopPropagation();
		searchText = '';
		isOpen = true;
	}

	export function reset() {
		searchText = '';  // Clear search text first
		value = 0;
		isOpen = false;
		onchange(0);
	}

	onMount(() => {
		if (value) {
			const selected = options.find(opt => opt.id === value);
			if (selected) {
				searchText = selected.name;
			}
		}
	});
</script>

<div 
	class="relative inline-block w-full min-w-[200px]" 
	use:clickOutside 
	on:clickoutside={handleClickOutside}
>
	{#if label}
		<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
	{/if}
	
	<div class="relative">
		<input
			type="text"
			bind:value={searchText}
			on:focus={() => isOpen = true}
			placeholder="Search..."
			class="w-full rounded-lg border border-gray-200 bg-white px-4 pr-16 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
		/>
		
		<div class="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
			{#if value !== 0}
				<button
					type="button"
					class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
					on:click={clearSearch}
				>
					<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
						<path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
					</svg>
				</button>
			{/if}
			<button
				type="button"
				class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
				on:click={() => isOpen = !isOpen}
			>
				<svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
					<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
				</svg>
			</button>
		</div>
	</div>

	{#if isOpen}
		<div class="absolute z-50 mt-1 w-full rounded-md bg-white shadow-lg dark:bg-gray-800">
			<ul class="max-h-[320px] overflow-auto rounded-md py-1 text-base">
				{#each filteredOptions as option}
					<li
						class="cursor-pointer select-none py-2 px-3 text-gray-900 hover:bg-blue-100 dark:text-gray-100 dark:hover:bg-blue-900"
						on:click={() => handleOptionSelect(option)}
					>
						{option.name}
					</li>
				{/each}
				{#if filteredOptions.length === 0}
					<li class="cursor-default select-none py-2 px-3 text-gray-500 dark:text-gray-400">
						No results found
					</li>
				{/if}
			</ul>
		</div>
	{/if}
</div>