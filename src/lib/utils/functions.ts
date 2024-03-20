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

