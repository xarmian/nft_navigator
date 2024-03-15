<script lang="ts">
    export let period: string = 'D'; // D, W, or M
    export let startTime = new Date();
    export let endTime = new Date();

    let periodOptions = [
        { id: 'D', name: 'Day' },
        { id: 'W', name: 'Week' },
        { id: 'M', name: 'Month' }
    ];

    let selectedPeriod = periodOptions.find((option) => option.id === period) ?? periodOptions[0];

    $: {
        period = selectedPeriod.id;
        
        const startEndTime = getPeriod(period);
        startTime = startEndTime.startTime;
        endTime = startEndTime.endTime;
    }

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
</script>

<div class="flex flex-row space-x-8 p-2 border-gray-300 border rounded-xl">
    {#each periodOptions as option}
        <button
            class="flex items-center justify-center py-1 px-3 rounded-md focus:outline-none 
            {option.id === selectedPeriod.id ? 'bg-blue-500 text-white dark:bg-blue-700 dark:text-gray-200' : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300'}"
            on:click={() => selectedPeriod = option}
        >
            {option.id}
        </button>
    {/each}
</div>