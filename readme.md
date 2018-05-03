# Hypertree

A Scalable Intercative Web Component for Hyperbolic Tree Visualisations

![Screen shot](res/img/screenshot.png?raw=true)

## Contents
- [Installing](#installing)
- [Embedding](#embedding)
- [API Reference](#apireference)       
    - [Model](#hierarchymodel)
    - [Filter](#filter)
    - [Geometry](#geometry)
    - [Interaction](#interaction)
- [Available Layers](#layers)        
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
<!-- 
TODO: describe Hypertree
api and update table
-->

The Hypertree Configuration object is passed as second argument to the Hypertree
contructor. It contains four sections which of only `model` is obligate.

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
| model           | `{}`            | -             | Visualized hierarchy data, including additional objects like tree pathes and selected (highlighted) nodes, as well as a icon map  for landmark nodes, and a language translation map. See section [HierarchyModel](#hierarchymodel) for details. |
| filter          | `{}`            |               | Scalability is achieved by permieter culling and weight culling. Permimeter culling removed small nodes near the unit circle, weight culling removes nodes width small weight. This configuration is only necessary if the dataset contains more than 1000 nodes. See section [Filter](#filter) for details. |
| geometry        | `{}`            |               | Defines visible layers and geometrical properties like node size, link curvature and others. See section [Geometry](#geometry). |
| interaction     | `{}`            |               | Used for user defined interaction events. See section [Interaction](#interaction). |

### <a name="hierarchymodel"></a> Model

```typescript
export interface HierarchyModel
{   
    data:         N,    
    iconmap:      {},    
    langmap:      {},    
    objects: {
        pathes:     { N, N }[],
        selections: N[],
    }
}
```

| Name            | Type            | Default       | Description            |         
|-----------------|-----------------|---------------|------------------------|
| data            | `N`             | -             | `N` is derived from d3-hierarchy node. See [D3 documentation](https://github.com/d3/d3-hierarchy/blob/master/README.md#hierarchy). It requirres an additional member id, which is used as key in iconmap and langmap to identify a node. d3.hierarchy and d3.stratify can be used if their input data contains such a member. |
| langmap         | `{}`            | `{}`          | If data files should be language independant this translatino map may be used to translate node labels. |
| iconmap         | `{}`            | `{}`          | Supports only unicode emojies |
| objects.pathes  | `{ N, N }[]`    | `[]`          | This array specifys highlighted pathes within the tree. The used nodes must be references to nodes within data. |
| objects.selections | `N[]`        | `[]`          | This array specifys highlighted nodes within the tree. The used nodes must be references to nodes within data. |

###  <a name="filter"></a> Filter

```typescript
export interface Filter
{       
    cullingRadius:   number,
    cullingWeight:   number | { min:number, max:number }, 
    weights:         (n)=> number,
    layout:          LayoutFunction,
    transformation:  {
        P: C,
        λ: C,
        θ: C,
    }
}
```

| Name            | Type            | Default       | Description            |         
|-----------------|-----------------|---------------|------------------------|
| model           | `{}`            | -             |                        |
| filter          | `{}`            |               |                        |
| geometry        | `{}`            |               |                        |
| interaction     | `{}`            |               |                        |

###  <a name="geometry"></a> Geometry

```typescript
export interface Geometry
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
| Name            | Type            | Default       | Description            |         
|-----------------|-----------------|---------------|------------------------|
| model           | `{}`            | -             |                        |
| filter          | `{}`            |               |                        |
| geometry        | `{}`            |               |                        |
| interaction     | `{}`            |               |                        |

### <a name="interaction"></a> Interaction

```typescript
export interface Interaction
{
    onNodeSelect: ((hypertree:Hypertree, n:N)=> void
}
```

| Name            | Type            | Default       | Description            |         
|-----------------|-----------------|---------------|------------------------|
| onNodeSelect | `((Hypertree, N)=> void` | `()=> {}` | Will be called when the user selects a node.     |

### <a name="layers"></a> Available Layers

| Name            | Description                                              |         
|-----------------|----------------------------------------------------------|
|                 |                                                          |

## <a name="default"></a> Example Configuration (Default Configuration)


```typescript
import { Hypertree } from 'd3-hypertree'
import { layouts } from 'd3-hypertree'

const hypertree = new Hypertree(
    {
        parent: document.body,
        preserveAspectRatio: "xMidYMid meet",
    },
    {   
        model: {
            iconmap: {},
            langmap: {},
            data:    d3.hierarchy(...),        
            objects: {}
        },
        filter: {
            cullingRadius:   .98,
            cullingWeight:   { min:200, max:400 }, 
            layout:          layouts.bergé,
            transformation:  {
                P: C,
                θ: C,
                λ: number,                
            }
        },
        geometry: {            
            addLayer:        ['Traces', 'Axes'],
            removeLayer:     ['Stem'],            
            nodeRadius:      .002,
            nodeScale:       d=> scales.hyperbolic,        
            arcWidth:        d=> Math.log(d.weight) * .002,        
            clipRadius:      1,                      
            labelRadius:     .9,
            animateUpRadius: .7,
        },
        interaction: {
            onNodeSelect: ((hypertree:Hypertree, n:N)=> void, 
        },
    }
}
```

Note that filter, geometry and interaction can be omitted if default configuration should be used.

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
