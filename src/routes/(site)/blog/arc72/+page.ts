import type { LayoutServerLoad } from '../../../$types';

export const load = (async () => {
	const pageMetaTags = {
		title: 'Understanding ARC-72 Tokens on Voi',
		description: 'NFTs exist in various forms, and ARC-72 tokens are one of them. Learn more about ARC-72 tokens and how they work on Voi.',
        imageUrl: '/images/arc72-blog-image-3.jpg'
	};

	return {
		pageMetaTags,
	};
}) satisfies LayoutServerLoad;
