<script lang="ts">
	// import need to init tailwind
	import '../app.css';
	import { page } from '$app/stores';
	import '@fortawesome/fontawesome-free/css/all.min.css'
	import { dev } from '$app/environment';

	//export let data: any;

  	// import { inject } from '@vercel/analytics';
	// inject({ mode: dev ? 'development' : 'production' });

	// $: metaTags = extend(true, {}, data.baseMetaTags, $page.data.pageMetaTags);

	$: metadata = $page.data.pageMetaTags ?? {};
	$: pageName = metadata.title ?? 'Home | NFT Navigator';
	$: description = metadata.description ?? 'Explore, search, and discover ARC-72 NFT Collections on the VOI Network';
	$: imageUrl = metadata.imageUrl ?? 'https://nftnavigator.xyz/android-chrome-192x192.png';
	//const twitterHandle = metadata.twitterHandle;
	$: siteName = metadata.siteName ?? ' NFT Navigator';
	$: cardType = metadata.cardType ?? 'summary';
</script>
<svelte:head>
	<title>{pageName} | NFT Navigator</title>
	<meta name="description" content="{description}" />
	<meta name="og:title" content="{pageName}" />
	<meta name="og:description" content="{description}" />
	<meta name="og:image" content="{imageUrl}" />
	<meta name="og:site_name" content="{siteName}" />
	<meta name="og:image:alt" content="{description}" />
	<meta name="twitter:card" content="{cardType}" />
	<meta name="twitter:title" content="{pageName}" />
	<meta name="twitter:description" content="{description}" />
	<meta name="twitter:image" content="{imageUrl}" />
	<meta name="twitter:image:alt" content="{description}" />
	<!--<meta name="twitter:site" content="{twitterHandle}" />
	<meta name="twitter:creator" content="{twitterHandle}" />-->
</svelte:head>
<slot />
