# Hypertree

A Scalable Intercative Web Component for Hyperbolic Tree Visualisations

![Screen shot](res/img/screenshot.png?raw=true)

## Contents
- [Installing](#installing)
- [Embedding](#embedding)
- [API Reference](#apireference)
    - [Hypertree Component](#hypertreecomponent)
    - [Hypertree Configuration](#hypertreeviewmodel)
        - [Model](#hierarchymodel)
        - [Filter](#filter)
        - [Geometry](#geometry)
        - [Interaction](#interaction)
- [Example Configuration](#default)

## Installing

```bash
npm install d3-hypertree --save
```

## Embedding
The d3-hypertree component is build with Webpack and exposes a prebuild CommonJS
module (dist/index.js). For custom builds please import 
"dist/js/components/hypertree/hypertree". The Components constructor takes two 
arguments: Parent element relation, and hypertree component configuration 
(HypertreeViewModel), see [Hypertree Configuration](#hypertreeviewmodel) for details.

To embedd the component in a CommonJS module, add one of the folloing lines 
to your css file:

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
        geometry: Geometry,
        interaction: Interaction,
    }
)
```

If no packaging tool is used, the imports can be replaced by adding the following 
lines to your html:

```html
<link  href="(path to module)/d3-hypertree/dist/index-browser-light.css" rel="stylesheet">
<script src="(path to module)/d3-hypertree/dist/index.js"></script>
```

## <a name="apireference"></a> API Reference

TODO: describe Hypertree

### <a name="hypertreecomponent"></a> Hypertree Component

### <a name="hypertreeviewmodel"></a> HypertreeViewModel

The HypertreeViewModel object is passed as second argument to the Hypertree
contructor.

```typescript
export interface HypertreeViewModel
{    
    model: HierarchyModel,
    filter: Filter,
    geometry: Space,
    interaction: Interaction,
}
```

| Name            | Type            | Default       | Description            |         
|-----------------|-----------------|---------------|------------------------|
| model           | {}              | -             | Visualized hierarchy data, including additional objects like tree pathes and selected (highlighted) nodes, as well as a icon map  for landmark nodes, and a language translation map. See section [HierarchyModel](#hierarchymodel) for details. |
| filter          | {}              |               | Scalability is achieved by permieter culling and weight culling. Permimeter culling removed small nodes near the unit circle, weight culling removes nodes width small weight. This configuration is only necessary if the dataset contains more than 1000 nodes. See section [Filter](#filter) for details. |
| geometry        | {}              |               | See section [Geometry](#geometry). |
| interaction     | {}              |               | See section [Interaction](#interaction). |

#### <a name="hierarchymodel"></a> HierarchyModel

```typescript
export interface HierarchyModel
{   
    iconmap:      {},    
    langmap:      {},
    data:         N,    
    objects: {
        pathes:     Path[],
        selections: N[],
    }
}
```

####  <a name="filter"></a> Filter

```typescript
export interface Filter
{       
    cullingRadius:   number,
    cullingWeight:   number | { min:number, max:number }, 
    weights:         (n)=> number,
    layout:          LayoutFunction,
    transformation:  Transformation<N>,
}
```

####  <a name="geometry"></a> Geometry

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


#### <a name="interaction"></a> Interaction

```typescript
export interface Interaction
{   
    onNodeSelect: ((hypertree:Hypertree, n:N)=> void
}
```

## <a name="default"></a> Example Configuration (Default Configuration)


```typescript
export interface HypertreeModel
{   
    interaction: {
        onNodeSelect: ((hypertree:Hypertree, n:N)=> void, 
    },
    model: {        
        iconmap:      {},
        langmap:      {},
        data:         N,        
        objects: {
            pathes:     Path[],
            selections: N[],            
        }
    },
    filter: {
        cullingRadius:   number,
        cullingWeight:   number | { min:number, max:number}, 
        layout:          LayoutFunction,
        transformation:  Transformation<N>,        
    },
    geometry: {
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

## Ignore it

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
