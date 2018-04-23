# Hypertree

## Installing

## Embedding

## API Reference

```typescript
export interface HypertreeViewModel
{    
    model: HierarchyModel,
    filter: Filter,
    unitdisk: Space,
    interaction: Interaction,
}
```

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
    },
    
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
