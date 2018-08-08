<!--
<p align="justify">
<p align="center">
<a href="https://glouwa.github.io/d3-hypertree/">
  <img src="docs/img/screenshot-light-github.png?raw=true">
</a>
</p>
</p>
-->

<!--
<iframe width="590" height="590" src="https://glouwa.github.io/" frameborder="0" allowfullscreen="allowfullscreen"></iframe>

<iframe width="560" height="315" src="http://www.youtube.com/embed/t6kxOXOJj8E" frameborder="0" allowfullscreen="allowfullscreen"></iframe>
-->

# D3-Hypertree
<!--
<p align="justify">
<p align="center">
A Scalable Intercative Web Component for Hyperbolic Tree Visualisations.
</p>
</p>
-->

<a href="https://glouwa.github.io/d3-hypertree/"><img 
src="docs/img/screenshot-light-github.png?raw=true" width="170" align="left" hspace="10" vspace="16"></a>

- Scalable up to 1000 nodes
- Scalable up to 50k nodes with weight culling and primeter culling
- Configurable mouse and touch interaction
- Configurable layers, visualisation presets
- Uses same data format as [d3.hierarchy()](https://github.com/d3/d3-hierarchy#hierarchy) 
- Alternatively file loaders for csv, json, skos, treeml can be used
<br>

## Resources
- [API Reference](https://glouwa.github.io/d3-hypertree/)
- [Live Demos](https://glouwa.github.io/d3-hypertree-examples/)
- [HTML / Webpack / Python Examples](https://github.com/glouwa/d3-hypertree-examples/)

## Installation

```bash
npm install d3-hypertree --save
```

<b>Or</b> download the [latest release](https://glouwa.github.io/d3-hypertree/)
of the prebuild bundle if npm is not used, 
and add the following lines to your page:

```html
<link  href="index-browser-light.css" rel="stylesheet">
<script src="d3-hypertree.js"></script>
```

The prebuild bundle declares the global variable `hyt`, 
so a import as in the usage example below is not necessary.
You can find the prebuild bundle also in the npm package `dist` folder. 

D3-hypertree is tested to be used with webpack. You may use import in a diffent way,
but the following usage examples will assume an import like this: 

```typescript
import * as hyt from 'd3-hypertree'
```

So the following examples are independent of you choices so far.

## Usage

```typescript
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

## Options Cheat Sheet

```typescript
export interface HypertreeArgs
{
    dataloader?:            LoaderFunction
    langloader?:            (lang)=> (ok)=> void    
    dataInitBFS:            (ht:Hypertree, n:N)=> void       // emoji, imghref
    langInitBFS:            (ht:Hypertree, n:N)=> void       // text, wiki, clickable, cell,
    objects: {
        roots:              N[]
        pathes:             Path[]
        selections:         N[]
        traces:             Trace[]
    }
    layout: {
        type:               LayoutFunction
        weight:             (n:N)=> number
        initSize:           number
        rootWedge: {
            orientation:    number
            angle:          number
        }
    }
    filter: {
        type:               'none' | 'const-weight' | 'dynamic-weight'
        cullingRadius:      number
        magic:              number                           // auto by init up
        weight:             (n)=> number
        rangeCullingWeight: { min:number, max:number }
        rangeNodes:         { min:number, max:number }
        alpha:              number
        focusExtension:     number        
        maxFocusRadius:     number
        wikiRadius:         number
        maxlabels:          number       
    }       
    geometry: {
        decorator:         Unitdisk | UnitdiskNav
        transformation:    Transformation<N>,    
        cacheUpdate:       (ud:IUnitDisk, cache:TransformationCache)=> void
        
        layers:            ((v, ls:IUnitDisk)=> ILayer)[]
        layerOptions:      {
            cells: {
                invisible:  false,
                hideOnDrag: false
            },
        }
        clipRadius:        number

        nodeRadius:        (ud:IUnitDisk, n:N)=> number
        nodeScale:         (n:N)=> number
        nodeFilter:        (n:N)=> boolean
        offsetEmoji:       (d, i, v)=> C
        offsetLabels:      (d, i, v)=> C

        captionBackground: 'all' | 'center' | 'none'        // x 
        captionFont:       string

        linkWidth:         (n:N)=> number
        linkCurvature:     ArcCurvature
    }
    interaction: {          
        //type:               'clickonly' | 'selction' | 'multiselection' | 'centernodeselectable'
        mouseRadius:        number,
        onNodeSelect:       (n:N)=> void
        onNodeHold:         ()=>void                          // x 
        onNodeHover:        ()=>void                          // x 
        λbounds:            [ number, number ]
        wheelFactor:        number
    }
}
```

