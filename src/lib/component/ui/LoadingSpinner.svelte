<script lang="ts">
    export let size = 40;
    export let color = '#3B82F6'; // Default to blue-500
</script>

<svg width={size} height={size} viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke={color}>
    <g fill="none" fill-rule="evenodd">
        <g transform="translate(1 1)" stroke-width="2">
            <circle stroke-opacity=".5" cx="18" cy="18" r="18"/>
            <path d="M36 18c0-9.94-8.06-18-18-18">
                <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 18 18"
                    to="360 18 18"
                    dur="1s"
                    repeatCount="indefinite"/>
            </path>
        </g>
    </g>
</svg>