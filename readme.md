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

- Compatible to [d3.hierarchy()](https://github.com/d3/d3-hierarchy#hierarchy) 
- Scalable up to 1000 nodes
- Scalable up to 50k nodes with weight filter and perimeter culling
- Mouse and touch interaction  
- Animation API 
- Compatible with WebKit and Blink browser engines
<br>



## Resources
- [API Reference](https://github.com/glouwa/d3-hypertree/blob/master/docs/readme.md)
- [Tree of Life Demo](https://hyperbolic-tree-of-life.github.io/)
- [API Demo](https://glouwa.github.io/d3-hypertree-examples/examples-html/mouse-events/)
- [HTML Examples](https://github.com/glouwa/d3-hypertree-examples/)

## Installation
```bash
npm install d3-hypertree --save
```
`node_modules/d3-hypertree/dist/` will contain all necessary files.

<b>Or</b> download the [latest release](https://cdn.jsdelivr.net/npm/d3-hypertree@1.1.0/dist/)
of the prebuilt bundle if npm is not used. 
The prebuilt bundle declares the global variable `hyt`, 
therefore an import as in the Webpack example below is not necessary.



And add the following lines to your page:
```html
<link  href="index-browser-light.css" rel="stylesheet">
<script src="d3-hypertree.js"></script>
```

## Webpack
D3-hypertree is tested with webpack. 
Remember to add one of the hypertree css files to your projects.
To make the example snippets compatible to the prebuilt bundle,
the following usage examples will assume an import like this:  
```typescript
import * as hyt from 'd3-hypertree'
```
Experts might prefer to import specific classes like `d3-hypertree/components/hypertree` to optimize bundle size.

## Usage
The following examples will guide you through the most important concepts, 
beginning with the most simple configuration, followed by more complex configurations.
For a complete list of configurations parameters 
See [API Reference](https://github.com/glouwa/d3-hypertree/blob/master/docs/readme.md) 
or section [Cheat Sheet](#Options-Cheat-Sheet)

The Hypertree constructor takes all configuration parameters, 
and returns a handle for starting animations or updating the data set.
d3 like callbacks are supplied to the constructor to create a data driven visualisation, 
see "Data Driven Configuration".

Guess what: The hypertree configuration is structured like a hierarchy.
The topmost objects component positioning configuration, 
and the visualisation configuration, 
containing configuration groups `layout`, `filter`, `interaction`, `geometry`.
See section [Cheat Sheet](#options-cheat-sheet) for the complete structure.
The following examples will only show some selected options.

### Constructing a Component
This first snippet shows the minimal configuration for creating a Hypertree component.
Parent DOM element and data source are required settings.
```typescript
mytree = new hyt.Hypertree(
    {
        parent: document.body,        
    },
    {        
        dataloader: hyt.loaders.fromFile('data/LDA128-ward.d3.json'),
        //dataloader: ok=> ok(d3.hierarchy(...)),
        //dataloader: ok=> ok(d3.stratify()...(table)),        
    }
)
```
You can also use `d3-hierarchy` object as data source, as shown in the comments.
You will see a hypertree without any labels or other features, see [Demo 1](). 
When a Hypertree is attached to a DOM node, all existing child nodes are removed.

### Data Driven Configuration
Visualizing node properties is achieved by using callbacks with the node as parameter.
It is the same concept as d3 uses, and in fact d3 is behind the scenes. 
However, in this case the for d3 typical parameter `d` is a always a node,
named `n` in the following examples.

A typical data driven property configuration looks like this:
```typescript
    nodeColor: function(n, i, v) {
        if (n.data.valueX>30) return 'red'
        else return 'blue'
    }
```
The given function is called by the renderer, for each frame, for each visible node.
JavaScript supports a shorter syntax for functions, called lambda expressions.
Most code snippets will use this syntax equivalent to the function above.
```typescript
    nodeColor: n=> (n.data.valueX>30 ? 'red' : 'blue')
```

#### The Node objects `n`
To calculate colors, or other visual properties, the `n` objects provide 
the following information: 
-   User defined data of node. accessible by `n.data`.
-   hierarchy structure derived from d3 (d3-hierarchy) `parent`, `children` and more,
    see [d3-hierarchy]().
-   hyperbolic coordinates, euclidean coordinates, layout. 
-   precalculated properties such as labels, image urls or properties hard to compute.
    See section [User defined Node Initialization].

See [TypeScript interface](https://github.com/glouwa/d3-hypertree/blob/master/src/models/n/n.ts) for a complete list of properties. 
And [d3-hierarchy]() for base functionality.
Keep in mind, usually its the most simple way to print the object `n` to the console when working with data driven functions.

#### User defined Node Initialization
`dataInitBFS` and `langInitBFS` are called at startup in Breath first order.
Use this functions to calculate static properties. 
Some layers expect specific properties in `n.precalc` like `label`, `icon`, `imageHref`, `clickable`, `cell`.
Label dimensions and layout weight will be stored by the hypertree component 
in `n.precalc`.
```typescript
    // dataInitBFS is called when data set changes.
    // node properties which do not change during runtime 
    // should be set in this function.
    // this way calculations are not necessary for each frame.
    dataInitBFS: (ht, n)=> {
        if (n.mergeId == 12)
            n.precalc.imageHref = 'img/example.png'   
    }, 
    // is called when data or language is changed, 
    // otherwise similar to dataInitBFS.
    // typically node labels are calculated in this function.
    langInitBFS: (ht, n)=> {                        
        n.precalc.label = `Label ${n.mergeId} / ${n.precalc.layoutWeight}`
    }
```

### Layer Configuration 
This example shows how to add labels and images to nodes by
enabling the according layers, 
and providing necessary node properties `n.precalc.label` and `n.precalc.imageHref`.

All Layers have the prperties `invisible` and `hideOnDrag`. 
Use invisible to deactivate a layer, use hideOnDrag to increase framerate 
if necessary. hideOnDrag will hide the layer only when animations or interactions are active.
Layers might contain additional configuration properties, 
see [Cheat Sheet](#options-cheat-sheet) for a complete list of options.
```typescript
const mytree = new hyt.Hypertree(
    { parent: document.body },
    { 
        dataloader: hyt.loaders.generators.nT1,
        dataInitBFS: (ht, n)=> {
            if (n.mergeId == 12)
                n.precalc.imageHref = 'img/example.png'         
        }, 
        langInitBFS: (ht, n)=> {                        
            n.precalc.label = `Label ${n.mergeId} / ${n.precalc.layoutWeight}`
        },        
        geometry: {                        
            layerOptions:       {                
                'cells':       { invisible: true, hideOnDrag: true },                
                'images':      { width: .1, height: .1 },
                'link-arcs':   { 
                    linkColor: n=> {
                        if (n.mergeId == 12) return 'orange'
                        return undefined
                    }
                }, 
                'nodes': {                     
                    nodeColor: n=> {
                        if (n.mergeId == 12) return 'yellow'
                        if (!n.children) return 'red'
                        return '#a5d6a7'
                    }
                }
            },                                               
        }
    }
)
```
It is possible to write [custom layer sets](https://github.com/glouwa/d3-hypertree/blob/master/src/models/hypertree/preset-layers.ts), and apply it by setting the `geometry.layers` property. 


### Non blocking API for Animations and Data updates
This example shows how to attach an annimation to the load process.
The Hypertree compoenent provides a JavaScript `Promise` for initialisation.
Attach promises to handle asyncronouse execution.
To start animations use the promise returning functions in `mytree.api` whereby `mytree` is your hypertree component variable.
```typescript
const mytree = new hyt.Hypertree(
    { parent: document.body }, 
    { dataloader: hyt.loaders.generators.nT1 }
)

var animationNode1 = mytree.data.children[1]
var animationNode2 = mytree.data.children[0].children[1]

mytree.initPromise
    .then(()=> new Promise((ok, err)=> mytree.animateUp(ok, err)))
    .then(()=> mytree.api.gotoNode(animationNode1))
    .then(()=> mytree.api.gotoNode(animationNode2))
    .then(()=> mytree.api.gotoHome())
    .then(()=> mytree.api.gotoλ(.25))
    .then(()=> mytree.api.gotoλ(.5))
    .then(()=> mytree.api.gotoλ(.4))
    .then(()=> mytree.drawDetailFrame())
```


### Interaction Event Handling
Basically some callbacks. 
Typical functions used in them:
- uer action like open view
- toggle path 
- ripple
- update path like root-hover path, or root-centernode path
- got animaion
```typescript
mytree = new hyt.Hypertree(
    { parent: document.body },
    { 
        dataloader: hyt.loaders.generators.nT1,
        interaction: {

            // the node click area is the voronoi cell in euclidean space.
            // this way, wherever the user clicks, a node can be associated.
            onNodeClick: (n, m, l)=> { 
                console.log(`#onNodeClick: Node=${n}, click coordinates=${m}, source layer=${l}`)

                mytree.api.goto({ re:-n.layout.z.re, im:-n.layout.z.im }, null)
                    .then(()=> l.view.hypertree.drawDetailFrame())       
            },
            
            // center node is defined as node with minimal distance to the center.
            onCenterNodeChange: n=> console.log(`#onCenterNodeChange: Node=${n}`)
        }       
    }
)
```

### Coordinate Systems and Transformations

## Options Cheat Sheet

This example shows a component instantiation using all configuration options. 
It uses TypeScript annotations to show parameter types.

For detailed documentation and a complete list of features see 
[API Reference](https://github.com/glouwa/d3-hypertree/blob/master/docs/readme.md).

```typescript
new hyt.Hypertree(
    {
        id:                     'my-component',
        classes:                'add-class another-class',
        parent:                 document.body,        
        preserveAspectRatio:    'xMidYMid meet'
    },
    {
        dataloader?:            LoaderFunction   
        dataInitBFS:            (ht:Hypertree, n:N)=> void
        langInitBFS:            (ht:Hypertree, n:N)=> void         
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
            cullingRadius:      number
            weightFilter:       null | number | {            
                weight:         (n)=> number
                rangeWeight:    { min:number, max:number }
                rangeNodes:     { min:number, max:number }
                alpha:          number
            }
            focusExtension:     number
            maxFocusRadius:     number
            wikiRadius:         number
            maxlabels:          number       
        }       
        geometry: {        
            layers:            ((v, ls:IUnitDisk)=> ILayer)[]
            layerOptions:      {
                cells: {
                    invisible:  false,
                    hideOnDrag: false,
                    // + layer specific properties 
                },
            }
            nodeRadius:        (ud:IUnitDisk, n:N)=> number
            nodeScale:         (n:N)=> number
            nodeFilter:        (n:N)=> boolean
            offsetEmoji:       (d, i, v)=> C
            offsetLabels:      (d, i, v)=> C

            captionBackground: 'all' | 'center' | 'root' | 'none' // x 
            captionFont:       string
            captionHeight:     number

            linkWidth:         (n:N)=> number
            linkCurvature:     ArcCurvature
        }
        interaction: {            
            mouseRadius:        number,
            onNodeClick:        (n:N)=> void
            onCenterNodeChange: (n:N)=> void 
            λbounds:            [ number, number ]
            wheelSensitivity:   number
        }
    }
)
```
