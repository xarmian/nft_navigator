<script lang="ts">
    import { Chart, Svg, Axis, Bars } from 'layerchart';
    import { Highlight, RectClipPath, Tooltip, TooltipItem } from 'layerchart';
    // @ts-ignore
    import { scaleBand } from 'd3-scale';
    import { format } from 'date-fns';
	import { Button, ButtonGroup } from 'flowbite-svelte';

    export let data: any[] = [];
    let view = 'volume';
</script>

<div>
    <div class="flex flex-row justify-end mb-2">
        <ButtonGroup class="space-x-px">
            <Button on:click={() => view = 'volume'} class={view == 'volume' ? 'outline' : ''}>Volume</Button>
            <Button on:click={() => view = 'sales'} class={view == 'sales' ? 'outline' : ''}>Sales</Button>
        </ButtonGroup>
    </div>
    <div class="h-[300px] p-4 border rounded group w-full bg-gray-100 dark:bg-gray-700 shadow-lg">
        <Chart
            data={data}
            x="date"
            xScale={scaleBand().padding(0.4)}
            y="{view == 'volume' ? 'value' : 'salesCount'}"
            yDomain={[0, null]}
            yNice
            padding={{ left: 16, bottom: 24 }}
            tooltip={{ mode: "band" }} >
            <Svg>
            <Axis placement="left" grid={{ style: "stroke-dasharray: 2" }}
            format={(v) => v.toLocaleString()}
            labelProps={{
                class: "fill-black stroke-white dark:fill-gray-200 dark:stroke-gray-800",
            }}
            />
            <Axis
            placement="bottom"
            rule
            format={(d) => {
                        return format(new Date(d), 'M/d haaa')
                    }
                }
            labelProps={{
                rotate: 315,
                textAnchor: "end",
                class: "fill-black stroke-white dark:fill-gray-200 dark:stroke-gray-800",
            }}
            />
            <Bars
                y={view == 'volume' ? 'value' : 'salesCount'}
                radius={4}
                strokeWidth={1}
                class="fill-accent-500 group-hover:fill-gray-300 transition-colors"
            />
            <Highlight area>
                <svelte:fragment slot="area" let:area>
                <RectClipPath
                    x={area.x}
                    y={area.y}
                    width={area.width}
                    height={area.height}
                    spring
                >
                    <Bars radius={4} strokeWidth={1} class="fill-accent-500" />
                </RectClipPath>
                </svelte:fragment>
            </Highlight>
            </Svg>
            <Tooltip header={(data) => format(new Date(data.date),'MM/dd/yyyy hh:ss a')} let:data>
                <TooltipItem label="Volume" value={data.value.toLocaleString()} />
                <TooltipItem label="VOI" value={data.voi.toLocaleString()} />
                <TooltipItem label="VIA" value={data.via.toLocaleString()} />
                <TooltipItem label="# Sales" value={data.salesCount} />
            </Tooltip>
        </Chart>
    </div>
</div>
