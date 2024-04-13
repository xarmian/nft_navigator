import type { MetaTagsProps } from 'svelte-meta-tags';
//import { createBrowserClient, isBrowser, parse } from '@supabase/ssr'
//import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

export const load = async ({ url, fetch, data, depends }) => {
  /*depends('supabase:auth');

  const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      fetch,
    },
    cookies: {
      get(key) {
        if (!isBrowser()) {
          return JSON.stringify(data.session);
        }

        const cookie = parse(document.cookie);
        return cookie[key];
      }
    }
  });

  const {
    data: { session },
  } = await supabase.auth.getSession()*/


  const baseMetaTags = Object.freeze({
    title: 'Normal',
    titleTemplate: '%s | NFT Navigator',
    description: 'Explore, search, and discover ARC-72 NFT Collections on the VOI Network',
    canonical: new URL(url.pathname, url.origin).href,
    openGraph: {
      type: 'website',
      url: new URL(url.pathname, url.origin).href,
      locale: 'en_IE',
      title: 'NFT Navigator',
      description: 'Explore, search, and discover ARC-72 NFT Collections on the VOI Network',
      siteName: 'NFTNavigator',
      images: [
        {
            url: 'https://nftnavigator.xyz/android-chrome-192x192.png',
            alt: 'NFT Navigator Image',
            width: 192,
            height: 192,
            secureUrl: 'https://nftnavigator.xyz/android-chrome-192x192.png',
            type: 'image/png'
          },
          {
            url: 'https://nftnavigator.xyz/android-chrome-512x512.png',
            alt: 'NFT Navigator Image',
            width: 512,
            height: 512,
            secureUrl: 'https://nftnavigator.xyz/android-chrome-512x512.png',
            type: 'image/png'
          }
        ],
    }
  }) satisfies MetaTagsProps;

  return {
    baseMetaTags,
    //supabase,
    //session,
    url
  };
};