<script>import { twMerge } from 'tailwind-merge';
    export let solid = false;
    export let navClass = 'flex';
    export let solidClass = 'flex px-5 py-3 text-gray-700 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700';
    export let olClass = 'inline-flex items-center space-x-1 md:space-x-3';
    export let ariaLabel = 'Breadcrumb';
    let classNav = solid ? solidClass : navClass;
    </script>
    
    <nav aria-label={ariaLabel} {...$$restProps} class={twMerge(classNav, $$props.class)}>
      <ol class={twMerge(olClass, $$props.classOl)}>
        <slot />
      </ol>
      {#if $$slots.right}
        <slot name="right" />
      {/if}
    </nav>
    
    <!--
    @component
    [Go to docs](https://flowbite-svelte.com/)
    ## Props
    @prop export let solid: boolean = false;
    @prop export let navClass: string = 'flex';
    @prop export let solidClass: string = 'flex px-5 py-3 text-gray-700 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700';
    @prop export let olClass: string = 'inline-flex items-center space-x-1 md:space-x-3';
    @prop export let ariaLabel: string = 'Breadcrumb';
    -->
    