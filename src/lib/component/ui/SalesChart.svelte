<script lang="ts">
    import * as echarts from 'echarts';
    import { onMount, afterUpdate } from 'svelte';
    import { format } from 'date-fns';
    import { Button, ButtonGroup } from 'flowbite-svelte';

    export let data: any[] = [];
    let view = 'volume';
    let chartDiv: HTMLElement;
    let chart: echarts.ECharts;

    function initChart() {
        if (chart) {
            chart.dispose();
        }
        chart = echarts.init(chartDiv);
        updateChart();
    }

    function updateChart() {
        if (!chart || !data.length) return;

        const option = {
            tooltip: {
                trigger: 'axis',
                formatter: (params: any) => {
                    const date = format(new Date(params[0].name), 'M/d haaa');
                    const value = view === 'volume' 
                        ? params[0].value.toLocaleString()
                        : params[0].value;
                    return `${date}<br/>${view === 'volume' ? 'Volume: ' : 'Sales: '}${value}`;
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '12%',
                top: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: data.map(d => d.date),
                axisLabel: {
                    formatter: (value: string) => format(new Date(value), 'M/d haaa'),
                    rotate: 45
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    formatter: (value: number) => value.toLocaleString()
                }
            },
            series: [{
                data: data.map(d => view === 'volume' ? d.value : d.salesCount),
                type: 'bar',
                itemStyle: {
                    color: 'var(--color-accent-500, #6366f1)'
                },
                emphasis: {
                    itemStyle: {
                        color: 'var(--color-gray-300, #d1d5db)'
                    }
                }
            }]
        };

        chart.setOption(option);
    }

    onMount(() => {
        initChart();
        
        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
            chart?.resize();
        });
        resizeObserver.observe(chartDiv);

        return () => {
            resizeObserver.disconnect();
            chart?.dispose();
        };
    });

    afterUpdate(() => {
        updateChart();
    });

    $: if (view) {
        updateChart();
    }
</script>

<div>
    <div class="flex flex-row justify-end mb-2">
        <ButtonGroup class="space-x-px">
            <Button on:click={() => view = 'volume'} class={view == 'volume' ? 'outline' : ''}>Volume</Button>
            <Button on:click={() => view = 'sales'} class={view == 'sales' ? 'outline' : ''}>Sales</Button>
        </ButtonGroup>
    </div>
    <div class="h-[300px] p-4 border rounded w-full bg-gray-100 dark:bg-gray-700 shadow-lg">
        <div bind:this={chartDiv} class="w-full h-full"></div>
    </div>
</div>
