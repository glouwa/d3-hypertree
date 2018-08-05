<p align="justify">
<p align="center">
<a href="https://glouwa.github.io/d3-hypertree/">
  <img src="docs/img/screenshot-light-github.png?raw=true">
</a>
</p>
</p>

# D3-Hypertree

A Scalable Intercative Web Component for Hyperbolic Tree Visualisations.

- Scalable up to 1000 nodes
- Scalable up to 50k nodes with weight culling and primeter culling
- Configurable mouse and touch interaction
- Configurable layers, visualisation presets
- Same data format as for [d3.hierarchy()](https://github.com/d3/d3-hierarchy#hierarchy) os used 
- Alternatively file loaders for csv, json, skos, treeml can be used

## Resources
- [API Reference](https://glouwa.github.io/d3-hypertree/)
- [Live Demos](https://glouwa.github.io/d3-hypertree-examples/)
- [HTML/Webpack/Python Examples](https://github.com/glouwa/d3-hypertree-examples/)

## Installation

```bash
npm install d3-hypertree --save
```

<b>Or</b> download the [latest release](https://glouwa.github.io/d3-hypertree/)
if no module bundler is used, and add the following lines to your page:

```html
<link  href="index-browser-light.css" rel="stylesheet">
<script src="d3-hypertree.js"></script>
```

The prebuild bundle declares the global variable `hyt`, 
so a import as in the example below is not necessary.

## Usage


```typescript
import * as hyt from 'd3-hypertree'

new hyt.Hypertree(
    {
        parent: document.body,
        preserveAspectRatio: "xMidYMid meet",
    },
    {
        model: hyt.loaders.fromFile('data/LDA128-ward.d3.json'),
    }
);
```

See [API Reference](https://glouwa.github.io/d3-hypertree/) for additional options.



