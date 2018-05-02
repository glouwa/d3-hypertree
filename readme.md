# Hypertree

A Scalable Intercative Web Component for Hyperbolic Tree Visualisation

![Screen shot](res/img/screenshot.png?raw=true)

## Installing

```bash
npm install d3-hypertree --save
```

## Embedding
The d3-hypertree component is build with Webpack and exposes a prebuild CommonJS module (dist/index.js). For custom builds please import "dist/js/components/hypertree/hypertree".
The Components constructor taks two arguments: Parent element relation, 
and hypertree component configuration (HypertreeViewModel), see [API-Reference](#API-Reference) for details.

To embedd the component in a CommonJS module, add one of the folloing lines to your css file:

```css
@import 'd3-hypertree/dist/index-browser-light';
```
or
```css
@import 'd3-hypertree/dist/index-browser-dark';
```

and instantiate (in this case as child of document.body) the Component: 

```typescript
import { Hypertree } from 'd3-hypertree'

const hypertree = new Hypertree(
    {
        parent: document.body,
        preserveAspectRatio: "xMidYMid meet",
    },
    {
        model: HierarchyModel,
        filter: Filter,
        unitdisk: Space,
        interaction: Interaction,
    })
```

If no packaging tool is used, the imports can be replaced by adding the following lines to your html:

```html
<link  href="(path to module)/d3-hypertree/dist/index-browser-light.css" rel="stylesheet">
<script src="(path to module)/d3-hypertree/dist/index.js"></script>
```


## API-Reference

A HypertreeViewModel object is passed as second argument to the Hypertree contructor.


```typescript
export interface HypertreeViewModel
{    
    model: HierarchyModel,
    filter: Filter,
    unitdisk: Space,
    interaction: Interaction,
}
```


| Name            | Type            | Default       | Description            |         
|-----------------|-----------------|---------------|------------------------|
| model           | {}              | -             | visualized hierarchy data, including additional objects like tree pathes and selected (highlighted) nodes, as well as a icon map  for landmark nodes, and a language translation map. See section [HierarchyModel](#HierarchyModel).
| filter          | {}              |               | visualized hierarchy data, including additional objects like tree pathes and selected (highlighted) nodes, as well as a icon map  for landmark nodes, and a language translation map. See section [HierarchyModel](#HierarchyModel).


## HierarchyModel

Data D contains:
- hierarchy, langmap,
- and stuff calculated at load (of data or langmap).
- at load also: convert objectrefs to N,
- collect wikinodes

```typescript
export interface HierarchyModel
{   
    iconmap:      {},    
    langmap:      {},
    data:         N,
    preactions:   ((hypertree:Hypertree, n:N)=> void)[],
    objects: {
        pathes:     Path[],
        selections: N[],
        traces:     Trace[],
    }
}
```

This produces the rendered model EM (D->EM). contains:
- (selective) layout 
- (selective) transformation
- sets or other for d3 prepared data structures

```typescript
export interface Filter
{       
    cullingRadius:   number,
    cullingWeight:   number,
    autoCw:          boolean | { min:number, max:number }, 
    layout:          LayoutFunction,
    transformation:  Transformation<N>,
    cacheUpdate:     (ud:IUnitDisk)=> void,      
    cache: {
        centerNode:     N,
        startNode:      N,
        unculledNodes:  N[],
        links:          N[],
        leafOrLazy:     N[],                             
        partOfAnyPath:  N[],
        labels:         N[],
        emojis:         N[],
        images:         N[],                             
        wikiRadius:     number,                              
        voronoiDiagram: d3.VoronoiDiagram<N>,                              
        cells:          d3.VoronoiPolygon<N>[]
    }    
}
```

contains
- layers
- global layer settings
- used to create renderer(EM) 
- renderer(EM) produces SVG

```typescript
export interface Space
{   
    layers:          ((ls:IUnitDisk)=> ILayer)[],
    nodeFilter:      (n:N)=> options.filters.hasCircle,
    nodeRadius:      number,
    nodeScale:       d=> number,        
    arcWidth:        d=> number,        
    clipRadius:      number,                      
    labelRadius:     number,
    animateUpRadius: number    
}
```

```typescript
export interface HypertreeModel
{   
    interaction: {
        onNodeSelect: ((hypertree:Hypertree, n:N)=> void, 
    },
    model: {
        preactions:   ((hypertree:Hypertree, n:N)=> void)[],                      
        iconmap:      {},
        langmap:      {},
        data:         N,        
        objects: {
            pathes:     Path[],
            selections: N[],
            traces:     Trace[],
        }
    },
    filter: {
        cullingRadius:   number,
        cullingWeight:   number,
        autoCw:          boolean | { min:number, max:number}, 
        layout:          LayoutFunction,
        transformation:  Transformation<N>,
        cacheUpdate:     (ud:IUnitDisk)=> void,      
        nodeFilter:      (n:N)=> options.filters.hasCircle,
        cache: {
            centerNode:     N,
            startNode:      N,
            unculledNodes:  N[],
            links:          N[],
            leafOrLazy:     N[],                             
            partOfAnyPath:  N[],
            labels:         N[],
            emojis:         N[],
            images:         N[],                             
            wikiRadius:     number,                              
            voronoiDiagram: d3.VoronoiDiagram<N>,                              
            cells:          d3.VoronoiPolygon<N>[]
        }
    },
    unitdisk: {
        layers:          ((ls:IUnitDisk)=> ILayer)[],
        addLayer:        ['Traces', 'Axes'],
        removeLayer:     ['Stem'],
        
        nodeRadius:      number,
        nodeScale:       d=> number,        
        arcWidth:        d=> number,        
        clipRadius:      number,                      
        labelRadius:     number,
        animateUpRadius: number,
    }
}
```

```typescript
export interface Interaction
{   
    onNodeSelect: ((hypertree:Hypertree, n:N)=> void
}
```

```typescript
export interface DecoModel
{  
    pathbuttons?: boolean,
    metabuttons?: boolean            
    navigation?: boolean | UnitdiskModel,  
    meta?: boolean,  
}
```
Youtube:
- Visualizing the sphere and the hyperbolic plane: five projections of each
  David Madorevivi
- Hyperbolic Geometry: An Introduction
  Uncommon Nonsense
- Illuminating hyperbolic geometry
  Henry Segerman
- What Is The Shape of Space? (ft. PhD Comics)
  minutephysics
