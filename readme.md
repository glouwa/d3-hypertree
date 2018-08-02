# Hypertree

A Scalable Intercative Web Component for Hyperbolic Tree Visualisations.

- Scalable up to 1000 nodes
- Scalable up to 100k nodes with weight culling and primeter culling
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
![Screen shot](docs/img/screenshot-light.png?raw=true)
