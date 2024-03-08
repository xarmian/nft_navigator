<script lang="ts">
    export let label: string = '';
    export let checked: boolean = false;
    export let onChange: Function | null = null;
    export let title = '';

    $: if (onChange) {
        onChange(checked);
    }
</script>


<div title={title}>
  <label class="switch">
      <input type="checkbox" bind:checked={checked}>
      <span class="slider round"></span>
  </label>
  <span class="label-text">{label}<slot/></span>
</div>

  <style>
  .switch {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 34px;
  }
  
  .switch input { 
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .4s;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 26px;
    width: 26px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: .4s;
  }
  
  input:checked + .slider {
    background-color: #2196F3;
  }
  
  input:focus + .slider {
    box-shadow: 0 0 1px #2196F3;
  }
  
  input:checked + .slider:before {
    transform: translateX(26px);
  }
  
  .slider.round {
    border-radius: 34px;
  }
  
  .slider.round:before {
    border-radius: 50%;
  }
  
  .label-text {
    margin: 0px 12px 0px 0px;
    vertical-align: middle;
    white-space: nowrap;
  }
</style>