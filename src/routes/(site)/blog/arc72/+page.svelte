<script>
	import SecondaryNavBar from "$lib/component/ui/SecondaryNavBar.svelte";

</script>
<SecondaryNavBar></SecondaryNavBar>
<main class="prose dark:prose-invert mx-2 lg:mx-40 px-4 py-8 mt-18">
<img src="/images/arc72-blog-image-3.jpg" class="w-full mb-6" alt="ARC-72 Tokens on Voi"/>
<h1 class="text-3xl font-bold mb-4">Understanding ARC-72 Tokens on Voi</h1>
<p class="mb-6">Various standards for Non-fungible tokens (NFTs) have emerged across different chains. 
    Voi has embraced the ARC-72 token standard, a newer NFT standard implemented as smart contracts on 
    AVM (Algorand Virtual Machine) blockchain networks.
</p>

<h2 class="text-2xl font-semibold mb-3">What Are ARC-72 Tokens?</h2>
<p class="mb-6">
    ARC-72 is a specification for NFTs on AVM blockchains, designed to be implemented as smart contracts. 
    This is a bit different from ARC-3 NFT Tokens commonly found on Algorand. Embracing ARC-72 NFTs allows for richer 
    functionality and greater flexibility, fostering a more interoperable and feature-rich NFT ecosystem.
</p>

<h2 class="text-2xl font-semibold mb-3">Key Benefits of ARC-72 Tokens</h2>
<ul class="list-disc list-inside mb-6">
    <li><strong>No Opt-In Required:</strong> 
        Unlike ASAs, ARC-72 tokens do not require users to opt-in to receive them. 
        This simplifies the user experience and reduces the friction in transferring NFTs.
    </li>
    <li><strong>Programmability:</strong> 
        Being implemented as smart contracts, ARC-72 tokens offer extensive programmability. 
        Developers can create custom methods and extend the functionality of NFTs beyond the basic ownership and transfer 
        operations.
    </li>
    <li><strong>Interoperability:</strong> 
        ARC-72 aims to standardize the core interfaces for NFTs on Voi, 
        ensuring compatibility across different applications and platforms.
    </li>
</ul>

<h2 class="text-2xl font-semibold mb-3">NFT Navigator meets ARC-72</h2>
<p class="mb-6">
    NFT Navigator takes advantage of the ARC-72 standard to provide a seamless experience for users.
    Each contract represents a collection of NFTs, and the metadata associated with each token is stored on-chain.
    This data is indexed using the publicly available 
    <a href='https://arc72-idx.nftnavigator.xyz/api-docs' target='_blank' class="text-blue-500 hover:text-blue-400">
        ARC-72 NFT Indexer
    </a> 
    and made searchable, allowing users to easily discover and explore NFTs on Voi.
</p>
    

</main>