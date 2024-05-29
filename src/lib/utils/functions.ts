import type { Token } from "$lib/data/types";

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
    
    if (rawUrl.includes('prod.cdn.highforge.io')) {
        return `https://prod.cdn.highforge.io/i/${encodeURIComponent(rawUrl)}?w=${width}`;
    }
    else {
        return rawUrl;
    }
}

export function getTokenImageUrl(token: Token, width?: number) {
    if (width && token.metadataURI.includes('prod.cdn.highforge.io')) {
        return `https://prod.cdn.highforge.io/i/${encodeURIComponent(token.metadataURI)}?w=${width}`;
    }
    else {
        return token.metadata?.image;
    }
}