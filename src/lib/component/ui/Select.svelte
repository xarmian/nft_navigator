<script context="module" lang="ts">
	export type SelectOption =
		| {
				id: string;
				name: string;
		  }
		| undefined;
</script>

<script lang="ts">
	export let options: SelectOption[] = [];

	export let value: string;
	export let selectClass = "border border-gray-300 rounded-full text-gray-600 h-10 pl-5 pr-10 bg-white hover:border-gray-400 focus:outline-none appearance-none dark:bg-gray-800 dark:text-white";
	export let containerClass = "";
</script>
<div class="relative inline-flex flex-col rounded-full dark:bg-gray-800 {containerClass}">
	<svg class="w-2 h-2 absolute top-0 right-0 m-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 232"><path d="M206 171.144L42.678 7.822c-9.763-9.763-25.592-9.763-35.355 0-9.763 9.762-9.763 25.591 0 35.354l189.21 189.209c9.372 9.373 24.749 9.373 34.121 0l189.21-189.209c9.763-9.763 9.763-25.592 0-35.354-9.763-9.763-25.592-9.763-35.355 0L206 171.144z" fill="#648299" fill-rule="nonzero"/></svg>
	<select bind:value={value} class={selectClass}>
		{#each options || [] as option}
			<option value={option?.id}>{option?.name}</option>
		{/each}
	</select>
</div>