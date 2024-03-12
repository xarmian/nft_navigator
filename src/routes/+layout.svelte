<script lang="ts">
	// import need to init tailwind
	import '../app.css';
	import { page } from '$app/stores';
	import '@fortawesome/fontawesome-free/css/all.min.css'
	import { MetaTags } from 'svelte-meta-tags';
	import extend from 'just-extend';

	export let data: any;

	import { dev } from '$app/environment';
  	// import { inject } from '@vercel/analytics';
	// inject({ mode: dev ? 'development' : 'production' });

	$: metaTags = extend(true, {}, data.baseMetaTags, $page.data.pageMetaTags);
</script>
<MetaTags {...metaTags} />
<!--<MetaTags title="NFT Navigator"
		  description="NFT Navigator" 
		  keywords={["NFT Algorand", "NFT Collections", "NFT Marketplace", "NFT Explorer", "NFT Search", "NFT Indexer"]}
		  openGraph={{
			url: 'https://nftnavigator.xyz',
			title: 'NFT Navigator',
			description: 'Explore, search, and discover ARC-72 NFT Collections on the VOI Network',
		}} />-->
<slot />
