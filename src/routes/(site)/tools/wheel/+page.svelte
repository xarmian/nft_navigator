<script lang="ts">
    import PieChart from '$lib/component/ui/PieChart.svelte';

    let names = '';
    let nameList: string[] = [];
    $: pieData = [];
    $: spinning = false;
    $: paused = false;
    let timer: NodeJS.Timeout | null = null;

    function updateNames() {
        nameList = names.split('\n').filter(name => name.trim() !== '');

        pieData = nameList.reduce((acc: any, name) => {
            const existingName = acc.find((item: { name: string, namefull: string }) => item.namefull === name);
            if (existingName) {
                existingName.value += 1;
            } else {
                acc.push({ name: name.substring(0,6)+'...', namefull: name, value: 1 });
            }
            return acc;
        }, []);
        
    }

    // spin for a random number of seconds between 10 and 20, then stop
    function spinPie() {
        if (timer) { 
            clearTimeout(timer);
            timer = null;
            spinning = false;
            paused = false;
        }

        spinning = true;
        timer = setTimeout(() => {
            paused = true;
        }, Math.random() * 2000 + 10000);
    }

    function resetPie() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        spinning = false;
        paused = false;
    }

</script>

<div class="dark:text-black flex flex-row space-x-2">
    <div class="flex flex-col">
    <textarea class="place-self-start m-4 h-64 w-64" bind:value={names} on:input={updateNames} placeholder="Paste names here, one per line"></textarea>
        <div class="flex justify-evenly">
            <button class="bg-blue-500 text-white rounded-lg p-2 place-self-center" on:click={spinPie}>
                Spin
                <i class="fas fa-sync-alt ml-2"></i>
            </button>
            <button class="bg-blue-500 text-white rounded-lg p-2 place-self-center" on:click={resetPie}>
                Reset
                <i class="fas fa-undo ml-2"></i>
            </button>
        </div>
    </div>
    <div class="piechartDiv {spinning ? 'spin' : ''} {paused ? 'pause' : ''}">
        <PieChart data={pieData} />
    </div>
    <div class="place-self-center">
        <i class="fas fa-arrow-left"></i>
    </div>
</div>
<style>
    .piechartDiv {
        width: 500px;
        height: 500px;
    }
    .piechartDiv.spin {
        animation: spin 2s linear infinite;
    }
    .piechartDiv.spin.pause {
        animation-play-state: paused;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>