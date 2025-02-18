<script lang="ts">
    import * as echarts from 'echarts';
    import { onMount, afterUpdate } from 'svelte';
    import { format } from 'date-fns';

    export let data: any[] = [];
    export let view: 'volume' | 'sales' | 'mints' = 'volume';
    export let chartType: 'bar' | 'line' = 'bar';
    export let showMA: boolean = false;
    let chartDiv: HTMLElement;
    let chart: echarts.ECharts;

    function calculateMA(data: number[], days: number) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < days - 1) {
                result.push('-');
                continue;
            }
            let sum = 0;
            for (let j = 0; j < days; j++) {
                sum += data[i - j];
            }
            result.push((sum / days).toFixed(2));
        }
        return result;
    }

    function initChart() {
        if (chart) {
            chart.dispose();
        }
        chart = echarts.init(chartDiv);
        updateChart();
    }

    function updateChart() {
        if (!chart || !data.length) return;

        const dates = data.map(d => d.date);
        const values = data.map(d => {
            switch (view) {
                case 'volume':
                    return d.value;
                case 'sales':
                    return d.salesCount;
                case 'mints':
                    return d.mintCount;
                default:
                    return 0;
            }
        });
        const voiValues = data.map(d => view === 'volume' ? d.voi : 0);
        const mintValues = data.map(d => view === 'mints' ? d.mintCount : (view === 'volume' ? d.mintVolume : 0));
        const maData = showMA ? calculateMA(values, 7) : [];

        const option = {
            animation: true,
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    label: {
                        backgroundColor: '#6a7985'
                    }
                },
                formatter: (params: any[]) => {
                    const date = format(new Date(params[0].name), 'MMM d, yyyy h:mm aaa');
                    let result = `<div class="font-bold">${date}</div>`;
                    params.forEach(param => {
                        if (param.value !== '-' && param.value !== 0) {
                            result += `<div style="color: ${param.color}">${param.seriesName}: ${Number(param.value).toLocaleString()}</div>`;
                        }
                    });
                    return result;
                }
            },
            toolbox: {
                feature: {
                    restore: {},
                    saveAsImage: {}
                },
                top: 0,
                right: '4%'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '15%',
                top: '40px',
                containLabel: true
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    start: 0,
                    end: 100
                }
            ],
            xAxis: {
                type: 'category',
                boundaryGap: chartType === 'bar',
                data: dates,
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
            series: view === 'volume' ? [
                {
                    name: 'Sales Volume',
                    type: chartType,
                    data: voiValues,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#6366f1' },
                            { offset: 1, color: '#818cf8' }
                        ])
                    },
                    emphasis: {
                        focus: 'series'
                    },
                    stack: chartType === 'bar' ? 'Total' : undefined
                },
                {
                    name: 'Mint Volume',
                    type: chartType,
                    data: mintValues,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#10b981' },
                            { offset: 1, color: '#34d399' }
                        ])
                    },
                    emphasis: {
                        focus: 'series'
                    },
                    stack: chartType === 'bar' ? 'Total' : undefined
                },
                ...(showMA ? [{
                    name: '7-day MA (Total)',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    data: calculateMA(data.map(d => (d.voi || 0) + (d.mintVolume || 0)), 7),
                    lineStyle: {
                        opacity: 0.5,
                        width: 2
                    }
                }] : [])
            ] : view === 'sales' ? [
                {
                    name: 'Sales',
                    type: chartType,
                    data: values,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#6366f1' },
                            { offset: 1, color: '#818cf8' }
                        ])
                    },
                    emphasis: {
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: '#4f46e5' },
                                { offset: 1, color: '#6366f1' }
                            ])
                        }
                    }
                },
                ...(showMA ? [{
                    name: '7-day MA',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    data: maData,
                    lineStyle: {
                        opacity: 0.5,
                        width: 2
                    }
                }] : [])
            ] : [
                {
                    name: 'Mints',
                    type: chartType,
                    data: mintValues,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#10b981' },
                            { offset: 1, color: '#34d399' }
                        ])
                    },
                    emphasis: {
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: '#059669' },
                                { offset: 1, color: '#10b981' }
                            ])
                        }
                    }
                },
                ...(showMA ? [{
                    name: '7-day MA',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    data: maData,
                    lineStyle: {
                        opacity: 0.5,
                        width: 2
                    }
                }] : [])
            ]
        };

        chart.setOption(option, true);
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

    $: if (data || view || chartType || showMA) {
        if (chart) {
            updateChart();
        }
    }
</script>

<div class="h-full w-full">
    <div bind:this={chartDiv} class="w-full h-full"></div>
</div>
