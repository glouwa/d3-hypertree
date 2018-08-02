# Hypertree

A Scalable Intercative Web Component for Hyperbolic Tree Visualisations.

- Scalable up to 1000 nodes
- Scalable up to 50k nodes with weight culling and primeter culling
- Configurable mouse and touch interaction
- Configurable layers, visualisation presets
- File loaders for csv, json, skos, treeml

# Resources
- [API Reference](https://glouwa.github.io/d3-hypertree/)
- [Live Demos](https://glouwa.github.io/d3-hypertree-examples/)
- [Examples](https://github.com/glouwa/d3-hypertree-examples/)

# Installation

```bash
npm install d3-hypertree --save
```

Or download the [latest release](https://glouwa.github.io/d3-hypertree/)
if no bundel tool is used and add the following lines to your page:

```html
<link  href="index-browser-light.css" rel="stylesheet">
<script src="d3-hypertree.js"></script>
```

The bprebuild bundle declares the global variable ht, 
so a import as in the example below is not necessary.

# Usage


```typescript
import * as ht from 'd3-hypertree'

new ht.Hypertree(
    {
        parent: document.body,
        preserveAspectRatio: "xMidYMid meet",
    },
    {
        model: ht.loaders.fromFile('data/LDA128-ward.d3.json'),
    }
);
```

See [API Reference](https://glouwa.github.io/d3-hypertree/) for details.
![Screen shot](docs/img/screenshot-light.png?raw=true)
