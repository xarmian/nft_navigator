<script lang="ts">
	// import need to init tailwind
	import '../app.css';
	import '@fortawesome/fontawesome-free/css/all.min.css'
	import { MetaTags } from 'svelte-meta-tags';

	import { dev } from '$app/environment';
  	// import { inject } from '@vercel/analytics';
	// inject({ mode: dev ? 'development' : 'production' });
</script>

<MetaTags title="NFT Navigator"
		  description="NFT Navigator" 
		  keywords={["NFT Algorand", "NFT Collections", "NFT Marketplace", "NFT Explorer", "NFT Search", "NFT Indexer"]}
		  openGraph={{
			url: 'https://nftnavigator.xyz',
			title: 'NFT Navigator',
			description: 'Explore, search, and discover ARC-72 NFT Collections on the VOI Network',
		}} />
<slot />
