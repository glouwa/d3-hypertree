import { C, Cp, Ck }     from '../../models/transformation/hyperbolic-math'
import { HierarchyNode } from 'd3'
import { Path } from '../path/path';

export interface NodePrecalulations {
    weight:             number
    weightScale:        number
    icon:               string
    txt:                string
    label:              string
    labellen:           number
    imageHref:          string

    txt2: string
    wiki: string
    clickable: boolean
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


