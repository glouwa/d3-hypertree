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

The Hypertree constructor takes all configuration parameters, 
and returns a handle for starting animating or updating the data of the component.
d3 like callbacks are supplied to the constructor to create a data driven visualisation, 
see "Data Driven Configuration".

Guess what: The hypertree configuration is structured like a hierarchy.
The topmost objects component positioning configuration, 
and the visualisation configuration, 
containing configuration groups `layout`, `filter`, `interaction`, `geometry`.
For a complete list of configurations parameters 
See [API Reference](https://github.com/glouwa/d3-hypertree/blob/master/docs/readme.md) 
or section [Cheat Sheet]

### Constructing a Component

This first snippet shows the minimal configuration for creating a hypertree component.

Only parent DOM element and data source, in this case a file in d3 JSON format is sufficient. 
You can also use `d3-hierarchy` object as data source, as show in the comments.
You will see a hypertree without any labels or other features, see [Demo 1]().  

When a Hypertree is attached to a DOM node, all existing child nodes are removed.

```typescript
new hyt.Hypertree(
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

### Global Parameters
### Data Driven Configuration
#### The Node Class N 
#### User defined Node Initialization
### Layer Configuration 
### Non blocking API for Animations and data updates
### Event Handling

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
        dataInitBFS:            (ht:Hypertree, n:N)=> void       // emoji, imghref
        langInitBFS:            (ht:Hypertree, n:N)=> void       // text, wiki, clickable, cell,
        objects: {
            roots:              N[]
            pathes:             Path[]
            selections:         N[]    
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
            //type:               'clickonly' | 'selction' | 'multiselection' | centernodeselectable'
            mouseRadius:        number,
            onNodeSelect:       (n:N)=> void
            onNodeHold:         ()=>void                          // x 
            onNodeHover:        ()=>void                          // x 
            λbounds:            [ number, number ]
            wheelSensitivity:   number
        }
    }
)
```
