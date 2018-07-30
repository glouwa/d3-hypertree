A Scalable Intercative Web Component for Hyperbolic Tree Visualisations

![Screen shot](/d3-hypertree/img/screenshot-light.png?raw=true)

# Embedding

## As Bundle 
If no packaging tool is used, the imports can be replaced by adding the following 
lines to your html:

```html
<link  href="(path to module)/d3-hypertree/dist/index-browser-light.css" rel="stylesheet">
<script src="(path to module)/d3-hypertree/dist/index.js"></script>
```
Use the global variable `hypertree` to access the module. 
See https://github.com/glouwa/d3-hypertree-examples for minimal working examples.


## With NPM
```bash
npm install d3-hypertree --save
```

The d3-hypertree component is build with Webpack and exposes a prebuild CommonJS
module (dist/index.js). For custom builds please import 
"dist/js/components/hypertree/hypertree". The Components constructor takes two 
arguments: Parent element relation, and hypertree component configuration 
(HypertreeViewModel), see [Hypertree Configuration](#apireference) for details.

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
# <a name="default"></a> Examples
## Repository
## HTML with bundle
## CommonJS minimal
## Typescrpt minimal

# <a name="apireference"></a> API Reference
<!-- 
TODO: describe Hypertree
api and update table
-->

The Hypertree Configuration object is passed as second argument to the Hypertree
contructor. It contains four sections which of only `model` is obligate.

Predefined configurations are found `d3-hypertree.presets`.

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

## <a name="hierarchymodel"></a> Model

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
| objects.pathes  | `{s:N,e:N}[]`   | `[]`          | This array specifys highlighted pathes within the tree. The used nodes must be references to nodes within data. |
| objects.selections | `N[]`        | `[]`          | This array specifys highlighted nodes within the tree. The used nodes must be references to nodes within data. |

##  <a name="filter"></a> Filter

```typescript
export interface Filter
{       
    cullingRadius:   number,
    cullingWeight:   number | { min:number, max:number }, 
    weights:         (n)=> number,
    layout:          LayoutFunction,
    transformation:  {
        P: C,        
        θ: C,
        λ: C,
    }
}
```

| Name            | Type            | Default       | Description            |         
|-----------------|-----------------|---------------|------------------------|
| cullingRadius   | `number`        | `.98`         | Nodes outside the circle with center 0,0 and radius `cullingRadius` will be hidden. |
| cullingWeight   | `number | { min:number, max:number}` | `{ min:200, max:400 }` | Culling weight can be specified as constant weight, or as a range which defined the minimun and maximum number of visible nodes. If so, the culling weight will be calculated automatically. |
| weights         | `(n)=> number`  | `d=> d.value?1:0` | Will be used as argument for d3 node.sum. See [D3 documentation](https://github.com/d3/d3-hierarchy/blob/master/README.md#hierarchy). |
| layout          | `(n)=> {}`      | `layouts.bergè` | Bergé layout implementation. Currently the only one which supports efficient node culling. |
| transformation.P | `C`            | { re:0, im:0 } | Initial hyperbolic translation. Use P to define the initial root node position. |
| transformation.λ | `number`       | `undefined`     | Defines the initial link lenght. Valid values are  in intervall (0,1). This parameter is not used if geometry.animateUpRadius is defined. |


##  <a name="geometry"></a> Geometry

```typescript
export interface Geometry
{   
    addLayer:        ['traces', 'images'],
    removeLayer:     ['stem-arc'],    
    nodeScale:       d=> number,
    arcWidth:        d=> number,
    clipRadius:      number,                      
    labelRadius:     number,
    animateUpRadius: number    
}
```
| Name            | Type            | Default       | Description            |         
|-----------------|-----------------|---------------|------------------------|
| nodeRadius      | `string[]`      | `[]`          | Enables additional layers. See [Layers](#layers) for details |
| nodeRadius      | `string[]`      | `[]`          | Disables default layers. See [Layers](#layers) for details  |
| nodeRadius      | `d=> number`    | `d=> acosh(d.pos.r)*.02` | Define node size for a node  |
| arcWidth        | `d=> number`    | `d=> acosh(d.pos.r)*.015` | Define link width for a node  |
| clipRadius      | `number`        | `1`           | Component clipping circle radius. Circle center at 0,0 |
| labelRadius     | `number`        | `.005`        | Distance between label center and node center. Not applied on force dirceted label layout. |
| animateUpRadius | `number or undefined` | `.8`       | If specified, transformation.λ will be set to a value such that the initial tree will fit within a circle with radius `animateUpRadius`. This circle is centered at transformation.P. |

## <a name="interaction"></a> Interaction

```typescript
export interface Interaction
{
    onNodeSelect: (n:N)=> void
}
```

| Name            | Type            | Default       | Description            |         
|-----------------|-----------------|---------------|------------------------|
| onNodeSelect | `(n:N)=>void` | `()=>{}` | Will be called when the user selects or deselects a node given by parameter `n` |


## Full Default Configration

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
                λ: number,                
            }
        },
        geometry: {            
            addLayer:        ['traces', 'images'],
            removeLayer:     ['stem-arc'],            
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

## <a name="layers"></a> Available Layers

| Name            | Visibility (default) | Description                       |   
|-----------------|---------|------------------------------------------------|
| cell-layer      |         | Renders voronoi cells of nodes. Cell defines mouse area of a node. |
| center-node     | ✓       | Gray circle background for node next to 0,0    |
| path-arcs       | ✓       | Hyperbolic arc links for pathes                |
| path-lines      |         | Straight line links for pathes                 |
| link-arcs       | ✓       | Hyperbolic arc links                           |
| link-lines      |         | Straight line links                            |
| nodes           | ✓       | Circle nodes                                   |
| images          |         | Renders a image for each node with a imgref member. Imgref must be a valid image url. The image is centered at the node position |
| emojis          | ✓       | Renders a emojie for each node occurring in iconmap |
| labels          |         | Renders labels nex to node                     |
| labels-force    | ✓       | Avoids label overlapping by a force directed layout. |
| traces          |         | Shows touch interaction by rendering a polyline for each touch  |

# Extended API

## Animations
## Path Highlighting
## Search

<!--
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
-->
