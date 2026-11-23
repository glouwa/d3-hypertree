import { C, Cp, Ck }     from '../transformation/hyperbolic-math'
import { HierarchyNode } from 'd3'
import { Path } from '../path/path';

export interface NodePrecalulations {
    layoutWeight:       number
    cullingWeight:      number
    visWeight:          number
    
    weight:             number
    weightScale:        number    
    label:              string
    labelOnHover?:      boolean     // the label only shows for the hovered node / its path (hoverLabel, hoverPathLabels)
    labellen:           number
    
    icon:               string  
    imageHref:          string    
    wiki:               string
    clickable:          boolean
    cell:               boolean
}

export interface NodeLayout {
    wedge: {
        α:              number,
        Ω:              number,
        L?:             number,
    },
    z?:                 Ck,
    zStrCache?:         string,
    zp?:                Cp,
}

export interface NodeTransformation {
    cache?:               C,
    cacheDisk?:           C,         // half-plane view: the disk position (cache holds the view position)
    outOfView?:           boolean,   // half-plane view: far above the view (no labels, emojis, symbols)
    cachep?:              Cp,
    strCache?:            string,    
    transformStrCache?:   string,
    transformStrCacheZ?:  string,

    scaleStrText?:        string,
    distScale?:           number,
    dampedDistScale?:     number,

    isOutλ,
    isOut99,
    isOutWeight,
    isOut,
    hasOutPeriChildren,
    hasOutWeightChildren,
    hasOutChildren:       boolean,            

    forcepoints?:         { x:number, y:number }                     // labels-force: center of the label
    placedLabel?:         { x:number, y:number, w:number, h:number } // labels-placed: box of the label
}

export interface NodePath {
    headof:                    Path,
    partof:                    Path[],
    finalcolor:                string,
    labelcolor:                string,

    isPartOfAnySelectionPath?: boolean,
    isPartOfAnyHoverPath?:     boolean,
}

export interface N extends NodeTransformation {    
    mergeId:            number,
    id:                 string,        // mess
    name?:              string,

    data:               any,           // d3
    parent:             N,             
    children:           Array<N>,      
    depth:              number,        
    height:             number,
    value?:             number,        

    ancestors,
    descendants,
    leaves,
    each,
    sum,

    precalc:            NodePrecalulations
    pathes:             NodePath

    // interaction state, set by the interaction (hover strategy, selection strategy);
    // the layers only decide how they show it
    hovered?:           boolean
    selected?:          boolean

    minWeight:          number
/*
    unitdisk: 
    {
        layout:         NodeLayout,
        transformation: NodeTransformation
    }
    navigationUnitdisk: 
    {
        layout:         NodeLayout,
        transformation: NodeTransformation
    }    
    */
    layout:             NodeLayout
    layoutReference:    NodeLayout
}


