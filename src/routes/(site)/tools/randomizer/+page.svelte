<script lang="ts">
    let names = '';
    let nameList: string[] = [];
    let timer: NodeJS.Timeout | null = null;
    let selectedIndex: number | null = null;
    let showSelectedWinner = false;

    function updateNames() {
        nameList = names.split('\n').filter(name => name.trim() !== '');
        nameList = shuffle(nameList);
    }

    function shuffle(names: string[]) {
        for (let i = names.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [names[i], names[j]] = [names[j], names[i]];
        }
        return names;
    }

    // for a random number of seconds (between 3 and 10), iterate selectedIndex through the number of names in nameList
    function runAnimation() {
        showSelectedWinner = false;
        if (timer) {
            clearTimeout(timer);
            timer = null;
            selectedIndex = null;
        }

        let i = 0;
        const duration = Math.floor(Math.random() * 8) + 3; // Random number between 3 and 10
        timer = setInterval(() => {
            selectedIndex = i;
            i++;
            if (i >= nameList.length) {
                i = 0;
            }
        }, 100);
        setTimeout(() => {
            if (timer) clearInterval(timer);
            timer = null;
            showSelectedWinner = true;
        }, duration * 1000);
    }

    function getRandomColor() {
        var letters = '0123456789ABCDEF';
        var color = '#';
        for (var i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

</script>

<div class="dark:text-black flex flex-row space-x-2">
    <div class="flex flex-col">
    <textarea class="place-self-start m-4 h-64 w-64" bind:value={names} on:input={updateNames} placeholder="Paste names here, one per line"></textarea>
        <div class="flex justify-evenly">
            <button class="bg-blue-500 text-white rounded-lg p-2 place-self-center" on:click={runAnimation}>
                Spin
                <i class="fas fa-sync-alt ml-2"></i>
            </button>
        </div>
    </div>
    <div class="flex flex-col">
        {#each nameList as name, i}
            <div class="flex flex-row">
                <div class="flex flex-row p-1" style="background-color: {getRandomColor()}">
                    <div class="flex flex-row w-64 justify-items-center {selectedIndex == i ? 'text-xl' : ''}">
                        <p>{name.substring(0, 8)}...{name.substring(name.length - 8)}</p>
                    </div>
                </div>
                {#if selectedIndex == i}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-6 w-6 ml-2" style="transform: rotate(180deg);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                </svg>
                {/if}
            </div>
        {/each}
    </div>
    <div>
        {#if selectedIndex != null && showSelectedWinner}
            <h2>The selected winner is:</h2>
            <div>{nameList[selectedIndex]}</div>
        {/if}
    </div>
</div>
<style>
</style>