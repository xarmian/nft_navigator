<script lang="ts">
	export let startDate: Date;
	export let endDate: Date;
	let activeSection = 'prize-pool';

	function toggleSection(section: string) {
		activeSection = activeSection === section ? '' : section;
	}
</script>

<div class="card p-4">
	<h2 class="text-2xl font-bold mb-4">Game Rules & Overview</h2>
	
	<div class="space-y-4">
		<!-- Prize Pool Section -->
		<div class="border rounded-lg overflow-hidden">
			<button 
				class="w-full p-4 text-left flex items-center justify-between bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
				on:click={() => toggleSection('prize-pool')}
			>
				<div class="flex items-center">
					<i class="fas fa-trophy text-yellow-500 mr-2"></i>
					<span class="font-semibold">Prize Pool Distribution</span>
				</div>
				<i class="fas fa-chevron-{activeSection === 'prize-pool' ? 'up' : 'down'}"></i>
			</button>
			
			{#if activeSection === 'prize-pool'}
				<div class="p-4 space-y-2">
					<p>Total potential pool: 100 Million VOI</p>
					<ul class="list-disc list-inside space-y-1">
						<li>10% fee on all transactions</li>
						<li>Voi Foundation matching up to 50 Million VOI</li>
					</ul>
					<div class="grid grid-cols-2 gap-4 mt-4">
						<div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
							<h4 class="font-bold mb-2">Traders (85%)</h4>
							<ul class="list-disc list-inside">
								<li>Volume: 42.5%</li>
								<li>Profit: 42.5%</li>
							</ul>
						</div>
						<div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
							<h4 class="font-bold mb-2">Creators (15%)</h4>
							<ul class="list-disc list-inside">
								<li>Minting: 10%</li>
								<li>Social: 5%</li>
							</ul>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Volume & Profit Rules Section -->
		<div class="border rounded-lg overflow-hidden">
			<button 
				class="w-full p-4 text-left flex items-center justify-between bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
				on:click={() => toggleSection('volume-profit')}
			>
				<div class="flex items-center">
					<i class="fas fa-chart-line text-blue-500 mr-2"></i>
					<span class="font-semibold">Volume & Profit Rules</span>
				</div>
				<i class="fas fa-chevron-{activeSection === 'volume-profit' ? 'up' : 'down'}"></i>
			</button>
			
			{#if activeSection === 'volume-profit'}
				<div class="p-4 space-y-4">
					<div>
						<h4 class="font-bold mb-2">Volume Points</h4>
						<ul class="list-disc list-inside">
							<li>Minting: Buyer gets volume points based on mint price</li>
							<li>Secondary Sales: Both buyer & seller get volume points based on sale price</li>
						</ul>
					</div>

					<div>
						<h4 class="font-bold mb-2">Profit Points</h4>
						<ul class="list-disc list-inside">
							<li>Points awarded when sale price exceeds base price</li>
							<li>Base price is set by mint price or highest previous sale</li>
							<li>Base price only increases, never decreases</li>
						</ul>
					</div>

					<div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
						<h5 class="font-bold mb-2">Example</h5>
						<p class="text-sm">NFT minted for 1000 VOI → Base price = 1000</p>
						<p class="text-sm">Sold for 1250 VOI → 250 profit points earned</p>
						<p class="text-sm">New base price = 1250 VOI</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Creator Rules Section -->
		<div class="border rounded-lg overflow-hidden">
			<button 
				class="w-full p-4 text-left flex items-center justify-between bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
				on:click={() => toggleSection('creator-rules')}
			>
				<div class="flex items-center">
					<i class="fas fa-paint-brush text-purple-500 mr-2"></i>
					<span class="font-semibold">Creator Rules</span>
				</div>
				<i class="fas fa-chevron-{activeSection === 'creator-rules' ? 'up' : 'down'}"></i>
			</button>
			
			{#if activeSection === 'creator-rules'}
				<div class="p-4 space-y-4">
					<div>
						<h4 class="font-bold mb-2">Minting Points (10%)</h4>
						<ul class="list-disc list-inside">
							<li>Points based on mint price</li>
							<li>Only creator receives these points</li>
						</ul>
					</div>

					<div>
						<h4 class="font-bold mb-2">Social Media Points (5%)</h4>
						<ul class="list-disc list-inside">
							<li>1 impression = 1 point</li>
							<li>Must include #VoiGames & @Voi_Net</li>
							<li>Only project account posts count</li>
							<li>Comments and replies excluded</li>
							<li>Limited to 1 X account per project</li>
						</ul>
					</div>
				</div>
			{/if}
		</div>

		<!-- Prize Distribution Section -->
		<div class="border rounded-lg overflow-hidden">
			<button 
				class="w-full p-4 text-left flex items-center justify-between bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
				on:click={() => toggleSection('prize-distribution')}
			>
				<div class="flex items-center">
					<i class="fas fa-gift text-green-500 mr-2"></i>
					<span class="font-semibold">Prize Distribution</span>
				</div>
				<i class="fas fa-chevron-{activeSection === 'prize-distribution' ? 'up' : 'down'}"></i>
			</button>
			
			{#if activeSection === 'prize-distribution'}
				<div class="p-4 space-y-4">
					<ul class="list-disc list-inside">
						<li>25 winners per category</li>
						<li>Each winner receives 4% of category prize pool</li>
						<li>Points convert to raffle tickets</li>
						<li>Single drawing after 2 weeks</li>
						<li>Multiple prizes possible per participant</li>
					</ul>

					<div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
						<p class="text-sm">Launch Day Bonus: 5,000 VOI for collections launching February 14th</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div> 