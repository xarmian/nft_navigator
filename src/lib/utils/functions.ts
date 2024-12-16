import type { Token } from "$lib/data/types";
import algosdk from 'algosdk';
import { zeroAddress } from '$lib/data/constants';

export function handleScroll(element: HTMLElement) {
    const update = () => {
        const scrollPosition = window.scrollY || document.documentElement.scrollTop;
        element.style.transform = `translateY(-${scrollPosition * 0.5}px)`;
    };

    window.addEventListener('scroll', update);
    update();

    return {
        destroy() {
            window.removeEventListener('scroll', update);
        }
    };
}

export function getImageUrl(rawUrl: string, width?: number) {
    if (!width) return rawUrl;
    
    if (rawUrl && rawUrl.includes('prod.cdn.highforge.io')) {
        return `https://prod.cdn.highforge.io/i/${encodeURIComponent(rawUrl)}?w=${width}`;
    }
    else if (rawUrl && rawUrl.includes('ipfs://')) {
        return rawUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    else {
        return rawUrl;
    }
}

export function getTokenImageUrl(token: Token, width?: number) {
    if (width && token && token.metadataURI && token.metadataURI.includes('prod.cdn.highforge.io')) {
        return `https://prod.cdn.highforge.io/i/${encodeURIComponent(token.metadataURI)}?w=${width}`;
    }
    else if (token.metadata?.image && token.metadata.image.includes('ipfs://')) {
        return token.metadataURI.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    else {
        return token.metadata?.image;
    }
}

export const decodeRoyalties = (royalties: string) => {
    const buf = Buffer.from(royalties, "base64");
    const royaltyPoints = buf.slice(0, 2).readUInt16BE(0);
    const creator1Points = buf.slice(2, 4).readUInt16BE(0);
    const creator2Points = buf.slice(4, 6).readUInt16BE(0);
    const creator3Points = buf.slice(6, 8).readUInt16BE(0);
    const creator1Address = algosdk.encodeAddress(buf.slice(8, 8 + 32 * 1));
    const creator2Address = algosdk.encodeAddress(buf.slice(8 + 32, 8 + 32 * 2));
    const creator3Address = algosdk.encodeAddress(
      buf.slice(8 + 32 * 2, 8 + 32 * 3)
    );
    const creatorAddressCount = [
      creator1Address,
      creator2Address,
      creator3Address,
    ].filter((addr) => addr !== zeroAddress).length;
    const royaltyPercent = (royaltyPoints / 10000) * 100;
    return {
      royaltyPercent,
      royaltyPoints,
      creator1Address,
      creator2Address,
      creator3Address,
      creator1Points,
      creator2Points,
      creator3Points,
      creatorAddressCount,
    };
  };