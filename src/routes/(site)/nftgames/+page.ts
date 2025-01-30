export const load = () => {
	const startDate = new Date('2025-02-14T17:00:00Z');
	const endDate = new Date('2025-02-28T17:00:00Z');

	const pageMetaTags = {
		title: 'VOI NFT Winter Games 2025',
		description: 'Join the VOI NFT Winter Games 2025! A two-week competition featuring trading volume, profit, minting, and social challenges. Running from February 14th to February 28th, 2025.',
		imageUrl: 'https://nftnavigator.xyz/images/nft-games-banner.png',
	};

	return {
		pageMetaTags,
		startDate,
		endDate
	};
}; 