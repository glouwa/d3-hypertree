# Hypertree

A Scalable Intercative Web Component for Hyperbolic Tree Visualisations.
See [Project page](https://glouwa.github.io/d3-hypertree/) for details and prebuild bundle.

```bash
npm install d3-hypertree --save
```

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
<iframe width="560" height="315" src="https://glouwa.github.io/" frameborder="0" allowfullscreen></iframe>