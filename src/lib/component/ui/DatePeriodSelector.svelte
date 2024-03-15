<script lang="ts">
	import { onMount } from "svelte";

    export let period: string | undefined = undefined; // D, W, or M, or C
    export let startTime: Date | undefined = undefined;
    export let endTime: Date | undefined = undefined;

    let periodOptions = [
        { id: 'D', name: 'Day' },
        { id: 'W', name: 'Week' },
        { id: 'M', name: 'Month' },
        { id: 'C', name: 'Custom' }
    ];

    // $: selectedPeriod = periodOptions.find((option) => option.id === period) ?? periodOptions[0];

    onMount(() => {
        if (!period) {
            if (startTime && endTime) {
                const today = new Date();
                let d = new Date();
                let w = new Date();
                let m = new Date();
                d.setDate(d.getDate() - 1);
                w.setDate(w.getDate() - 7);
                m.setMonth(m.getMonth() - 1);

                // calculate different between startTime and endTime -- if 24 hours = D, if 7 days = W, if 30 days = M. Otherwise = C
                if (endTime.getTime() - startTime.getTime() === today.getTime()-d.getTime()) period = 'D';
                else if (endTime.getTime() - startTime.getTime() === today.getTime()-w.getTime()) period = 'W';
                else if (endTime.getTime() - startTime.getTime() === today.getTime()-m.getTime()) period = 'M';
                else period = 'C';
            }
            else {
                setPeriod('D');
            }
        }
    });

    function getPeriod(period: string) {
        let startTime = new Date();
        let endTime = new Date();
        switch(period) {
            case 'D':
                startTime.setDate(startTime.getDate() - 1);
            break;
            case 'W':
                startTime.setDate(startTime.getDate() - 7);
            break;
            case 'M':
                startTime.setMonth(startTime.getMonth() - 1);
            break;
        }
        return { startTime, endTime };        
    }

    function setPeriod(periodId: string) {
        if (periodId === 'C') {
            // open date picker
        } else {
            const startEndTime = getPeriod(periodId);
            startTime = startEndTime.startTime;
            endTime = startEndTime.endTime;
            period = periodId;
        }
    }
</script>

<div class="flex flex-row space-x-1 md:space-x-3 p-2 border-gray-300 border rounded-xl">
    {#each periodOptions as option}
        <button
            class="flex items-center justify-center py-1 px-3 rounded-md focus:outline-none 
            {option.id === 'C' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 cursor-default' : ''}
            {option.id === period ? 'bg-blue-500 text-white dark:bg-blue-700 dark:text-gray-200' : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300'}"
            on:click={() => setPeriod(option.id)}
        >
            {option.id}
        </button>
    {/each}
</div>