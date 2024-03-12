<script lang="ts">
	// import need to init tailwind
	import '../app.css';
	import { page } from '$app/stores';
	import '@fortawesome/fontawesome-free/css/all.min.css'
	import { dev } from '$app/environment';

	export let data: any;

  	// import { inject } from '@vercel/analytics';
	// inject({ mode: dev ? 'development' : 'production' });

	// $: metaTags = extend(true, {}, data.baseMetaTags, $page.data.pageMetaTags);

	$: metadata = $page.data.pageMetaTags ?? {};
	$: pageName = metadata.title ?? 'Home | NFT Navigator';
	$: description = metadata.description ?? 'Explore, search, and discover ARC-72 NFT Collections on the VOI Network';
	$: imageUrl = metadata.imageUrl ?? 'https://nftnavigator.xyz/android-chrome-192x192.png';
	//const twitterHandle = metadata.twitterHandle;
	$: siteName = metadata.siteName ?? ' NFT Navigator';
</script>
<svelte:head>
	<title>{pageName} | NFT Navigator</title>
	<meta name="description" content="{description}" />
	<meta property="og:title" content="{pageName}" />
	<meta property="og:description" content="{description}" />
	<meta property="og:image" content="{imageUrl}" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="{pageName}" />
	<meta name="twitter:description" content="{description}" />
	<meta name="twitter:image" content="{imageUrl}" />
	<!--<meta name="twitter:site" content="{twitterHandle}" />
	<meta name="twitter:creator" content="{twitterHandle}" />-->
	<meta property="og:site_name" content="{siteName}" />
</svelte:head>
<slot />
