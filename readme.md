# Hypertree

A Scalable Intercative Web Component for Hyperbolic Tree Visualisations
See [Project page](https://glouwa.github.io/d3-hypertree/#geometry) for details.

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
        model: ht.loaders.fromFile('data/LDA128-ward.d3.json'),,        
    }
)
```
![Screen shot](docs/img/screenshot-light.png?raw=true)