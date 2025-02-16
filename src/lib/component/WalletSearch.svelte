<script lang="ts">
	/*
        A Svelte component containing an input field and submit button.

        When text is entered into the input field, if the text contains a period, a search is performed to look for an NFDomain. If an NFDomain match is found, a listing of unverified addresses attached to that NFDomain is shown below the input box as an "autocomplete", and a user is able to select one of the addresses.

        IF the user selects one of the addresses from the NFDomain, enters a full wallet address and presses enter, or clicks the submit button THEN open the page /wallet/[ADDRESS] where [ADDRESS] is the selected address in the input component.

        Things to utilize:
        Tailwind for styling

        Requirements:
        Both light and dark mode compatible
    */

	import { getAddressesForNFD } from '$lib/utils/nfd';
	import { toast } from '@zerodevx/svelte-toast';
	import { onMount, onDestroy } from 'svelte';
    import { SearchOutline } from 'flowbite-svelte-icons';
	import { connectedWallets, selectedWallet } from 'avm-wallet-svelte';
    import { searchEnvoi, type EnvoiSearchResult } from '$lib/utils/envoi';

	let searchText = '';
	/**
	 * @type {string | any[]}
	 */
	let addressList: string[] = [];
    let filteredWallets: EnvoiSearchResult[] = [];
	let selectedAddressIndex = -1;
	let windowDefined = false;
    let componentElement: any;
    let dropdownElement: HTMLElement;
    let inputElement: HTMLInputElement;
    let portalContainer: HTMLElement;
    let isOpen = false;
    export let onSubmit: (addr: string) => void = () => {};
    export let onChange: (addr: string) => void = () => {};
    export let loadPreviousValue: boolean = false;
    export let showSubmitButton: boolean = true;
    export let onPasteAddresses: (addresses: string[]) => void = () => {};
    export let autoFocus: boolean = false;
    export let value: string = '';

    function init(el: HTMLInputElement) {
        inputElement = el;
        if (autoFocus) {
            el.focus();
        }
    }

	// Function to handle text input changes
	async function handleInput(event: Event) {
        const target = event.target as HTMLInputElement;
        searchText = target.value;
        onChange(searchText);
        filteredWallets = [];
        addressList = [];

		if (searchText.includes('.algo')) {
			const addresses = await getAddressesForNFD(searchText);
            addressList = addresses;
		}
        else if (searchText.length == 58) {
            filteredWallets = [{ address: searchText, name: searchText, metadata: {} }];
        }
        else if (searchText.length >= 2) {
            const results = await searchEnvoi(searchText);
            filteredWallets = results;
        }
    }

	// Function to handle address selection or submit
	function handleSubmit(addr?: string) {
        if (loadPreviousValue) {
            localStorage.setItem('searchText', searchText);
        }

        if (selectedAddressIndex >= 0) {
            if (selectedAddressIndex < addressList.length) {
                addr = addressList[selectedAddressIndex];
            } else if (filteredWallets.length > 0) {
                addr = filteredWallets[selectedAddressIndex - addressList.length].address;
            }
        }

        if (!addr && searchText.length != 58) {
            if (addressList.length == 0 && filteredWallets.length == 0) {
                toast.push('Invalid address');
            }
            else {
                toast.push('Please select an address');
            }
            return;
        }

        if (searchText.length == 0 && addr) {
            searchText = addr;
        }

        searchText = addr ?? searchText;
        onSubmit(addr ?? searchText);
        addressList = [];
        filteredWallets = [];
        isOpen = false;
	}

    function handleClickOutside(event: MouseEvent) {
        if (!componentElement.contains(event.target)) {
            addressList = [];
            filteredWallets = [];
            isOpen = false;
        }
    }

    function handleClick() {
        if (document.activeElement !== inputElement) return;
        isOpen = true;
        if (searchText.length == 0) {
            addressList = [...new Set($connectedWallets.map((wallet) => wallet.address))];
            filteredWallets = [];
        }
        else {
            selectedAddressIndex = -1;
            onChange(searchText);
            filteredWallets = [];
            addressList = [];
            if (searchText.includes('.algo')) {
                getAddressesForNFD(searchText).then(addresses => {
                    addressList = addresses;
                });
            }
            else if (searchText.length == 58) {
                filteredWallets = [{ address: searchText, name: searchText, metadata: {} }];
            }
            else if (searchText.length >= 2) {
                searchEnvoi(searchText).then(results => {
                    filteredWallets = results;
                });
            }
        }
        setTimeout(updateDropdownPosition, 0);
    }

    function handleKeydown(event: KeyboardEvent) {
        if (document.activeElement !== inputElement) return;
        
        const totalResults = addressList.length + filteredWallets.length;
        
        if (event.key === 'Escape') {
            addressList = [];
            filteredWallets = [];
            selectedAddressIndex = -1;
            isOpen = false;
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            if (searchText && totalResults === 0) {
                handleInput(event);
            } else {
                selectedAddressIndex = event.key === 'ArrowUp'
                    ? Math.max(0, selectedAddressIndex - 1)
                    : Math.min(totalResults - 1, selectedAddressIndex + 1);
            }
            event.preventDefault();
        } else if (event.key === 'Enter') {
            let addr;
            if (selectedAddressIndex >= 0) {
                if (selectedAddressIndex < addressList.length) {
                    addr = addressList[selectedAddressIndex];
                } else {
                    addr = filteredWallets[selectedAddressIndex - addressList.length].address;
                }
            }
            else if (addressList.length > 0) {
                addr = addressList[0];
            }
            else if (filteredWallets.length > 0) {
                addr = filteredWallets[0].address;
            }
            else {
                addr = searchText;
            }
            handleSubmit(addr);
            event.preventDefault();
        } else if (event.key === 'f' && event.ctrlKey) {
            inputElement.focus();
            event.preventDefault();
        }
    }

    function updateDropdownPosition() {
        if (!isOpen || !componentElement || !dropdownElement) return;
        
        const rect = componentElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const dropdownHeight = Math.min(300, viewportHeight - 20); // 20px padding from viewport edges
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        dropdownElement.style.position = 'fixed';
        dropdownElement.style.maxHeight = `${dropdownHeight}px`;
        
        // Determine if we should show dropdown above or below
        const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
        
        if (showAbove) {
            // Position above the input
            const heightToUse = Math.min(dropdownHeight, spaceAbove - 10); // 10px padding from top
            dropdownElement.style.maxHeight = `${heightToUse}px`;
            dropdownElement.style.top = `${rect.top - heightToUse}px`;
        } else {
            // Position below the input
            dropdownElement.style.top = `${rect.bottom}px`;
        }
        
        // Handle horizontal positioning
        const dropdownWidth = rect.width;
        let left = rect.left;
        
        // If dropdown would go off right edge, align it with right edge of input
        if (left + dropdownWidth > viewportWidth) {
            left = viewportWidth - dropdownWidth;
        }
        
        // If dropdown would go off left edge, align it with left edge of viewport
        if (left < 0) {
            left = 0;
        }
        
        dropdownElement.style.left = `${left}px`;
        dropdownElement.style.width = `${rect.width}px`;
        dropdownElement.style.zIndex = '1000';
    }

	onMount(() => {
        windowDefined = typeof window !== 'undefined';
        if (windowDefined) {
            window.addEventListener('keydown', handleKeydown);
            document.addEventListener('click', handleClickOutside);
            window.addEventListener('scroll', updateDropdownPosition, true);
            window.addEventListener('resize', updateDropdownPosition);

            // Create portal container
            portalContainer = document.createElement('div');
            document.body.appendChild(portalContainer);

            if (loadPreviousValue) {
                const storedSearchText = localStorage.getItem('searchText');
                if (storedSearchText) {
                    searchText = storedSearchText;
                }
            }
        }
	});

	onDestroy(() => {
		if (windowDefined) {
			window.removeEventListener('keydown', handleKeydown);
            document.removeEventListener('click', handleClickOutside);
            window.removeEventListener('scroll', updateDropdownPosition, true);
            window.removeEventListener('resize', updateDropdownPosition);
            if (portalContainer && portalContainer.parentNode) {
                portalContainer.parentNode.removeChild(portalContainer);
            }
		}
	});

    function handlePaste(event: ClipboardEvent) {
        const pastedText = event.clipboardData?.getData('text');
        if (!pastedText) return;

        console.log('Raw pasted text:', pastedText);

        // Split by newlines first, then try other delimiters if we don't get valid addresses
        let potentialAddresses = pastedText
            .split(/[\n\r]+/) // Split by newlines first
            .map(line => line.trim())
            .filter(line => line.length > 0);

        console.log('After newline split:', potentialAddresses);

        // If we don't have multiple lines, try splitting by other delimiters
        if (potentialAddresses.length <= 1) {
            potentialAddresses = pastedText
                .split(/[,\t\s]+/)
                .map(addr => addr.trim())
                .filter(addr => addr.length > 0);
            console.log('After delimiter split:', potentialAddresses);
        }

        // Filter for valid Algorand addresses
        const validAddresses = potentialAddresses.filter(addr => addr.length === 58);
        console.log('Valid addresses:', validAddresses);

        if (validAddresses.length > 0) {
            event.preventDefault();
            onPasteAddresses(validAddresses);
            searchText = validAddresses[0];
            onChange(validAddresses[0]);
            isOpen = false;
        }
    }
</script>

<div class="mx-auto relative" bind:this={componentElement}>
    <div class="bg-white dark:bg-gray-800 flex relative rounded-md border border-gray-200 dark:border-gray-700">
        <input
            type="text"
            use:init
            value={value}
            on:input={handleInput}
            on:click={handleClick}
            on:paste={handlePaste}
            class="bg-white dark:bg-gray-800 flex-grow text-gray-900 dark:text-white p-2 w-full pr-9 rounded-l-md focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:outline-none border-0"
            placeholder="Select wallet by Address or enVoi name"
        />
        <button on:click={() => { searchText = ''; addressList = []; filteredWallets = []; isOpen = false; onChange(''); }} 
                class="absolute right-0 top-0 p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
            <span class="rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 w-6 h-6 flex items-center justify-center transition-colors">
                X
            </span>
        </button>

        {#if showSubmitButton}
            <button on:click={() => handleSubmit(undefined)} 
                    class="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 rounded-r-md transition-colors">
                <div class="hidden md:block">Submit</div>
                <div class="block md:hidden">
                    <SearchOutline />
                </div>
            </button>
        {/if}
    </div>
</div>

{#if isOpen && (addressList.length > 0 || filteredWallets.length > 0)}
<div bind:this={dropdownElement} class="dropdown-portal">
    <div class="fixed inset-0 bg-black/5 dark:bg-black/20" style="z-index: 49;" on:click|self={() => isOpen = false}></div>
    <div class="absolute bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg" style="z-index: 50;">
        <ul class="w-full overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700" style="max-height: 300px;">
            {#each addressList as address, index}
                <li class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors {index === selectedAddressIndex ? 'bg-gray-100 dark:bg-gray-600' : ''}"
                    on:mouseover={() => selectedAddressIndex = index}>
                    <button class="w-full text-left flex items-center gap-3 p-3" on:click={() => handleSubmit(address)}>
                        <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                            <span class="text-blue-600 dark:text-blue-300 text-base">W</span>
                        </div>
                        <div class="flex flex-col flex-grow min-w-0">
                            <span class="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">Connected Wallet</span>
                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{address}</span>
                        </div>
                    </button>
                </li>
            {/each}
            {#each filteredWallets as wallet, index}
                <li class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors {(index + addressList.length) === selectedAddressIndex ? 'bg-gray-100 dark:bg-gray-600' : ''}"
                    on:mouseover={() => selectedAddressIndex = index + addressList.length}>
                    <button class="w-full text-left p-3" on:click={() => handleSubmit(wallet.address)}>
                        <div class="flex items-center gap-3">
                            {#if wallet.metadata?.avatar}
                                <img 
                                    src={wallet.metadata.avatar} 
                                    alt={`${wallet.name} avatar`}
                                    class="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                            {:else}
                                <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                                    <span class="text-blue-600 dark:text-blue-300 text-base">
                                        {wallet.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            {/if}
                            <div class="flex flex-col flex-grow min-w-0">
                                <span class="text-base font-medium text-gray-900 dark:text-gray-100 truncate">{wallet.name}</span>
                                <span class="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{wallet.address}</span>
                            </div>
                        </div>
                    </button>
                </li>
            {/each}
        </ul>
    </div>
</div>
{/if}

<style lang="postcss">
	ul {
		@apply bg-transparent dark:bg-transparent;
        scrollbar-width: thin;
        scrollbar-color: theme('colors.gray.400') theme('colors.gray.600');
        overscroll-behavior: contain;
	}

	button {
		@apply text-gray-900 dark:text-white;
        @apply transition-colors duration-150;
	}

    :global(.dropdown-portal) {
        position: fixed;
        z-index: 50;
    }

    /* Custom scrollbar styles for Webkit browsers */
    ul::-webkit-scrollbar {
        width: 6px;
    }

    ul::-webkit-scrollbar-track {
        @apply bg-gray-100 dark:bg-gray-700;
    }

    ul::-webkit-scrollbar-thumb {
        @apply bg-gray-300 dark:bg-gray-600;
        border-radius: 3px;
    }

    ul::-webkit-scrollbar-thumb:hover {
        @apply bg-gray-400 dark:bg-gray-500;
    }
</style>
