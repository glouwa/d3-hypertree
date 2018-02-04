import { C, Cp, Ck }     from '../../models/transformation/hyperbolic-math'
import { HierarchyNode } from 'd3'

export interface Path {    
    type:      string,
    id:        string,
    icon:      string,
    head:      N,
    headName:  string,
    ancestors: N[],
    color:     string
}

export interface N {    
    mergeId:            number,
    id:                 string,        //
    name?:              string,

    data:               any,           //
    parent:             N,             //?
    children:           Array<N>,      //?
    depth:              number,        //
    height:             number,
    value?:             number,        //

    ancestors,
    descendants,
    leaves,
    each,
    sum,

//  labels
    precalc: {
        weight:             number
        weightScale:        number
        icon:               string
        txt:                string
        label:              string
        labellen:           number
        imageHref:          string
    }
    
    layout: {
        wedge: {
            α:              number,
            Ω:              number,
        },
        z?:                 Ck,
        zStrCache?:         string,
        zp?:                Cp,
    }
    layoutReference: {
        wedge: {
            α:              number,            
            Ω:              number,
        },
        z?:                 Ck,
        zStrCache?:         string,
        zp?:                Cp,
    }

//cahce
    cache?:             C,
    cachep?:            Cp,
    strCache?:          string,    

    isOutλ,
    isOut99,
    isOutWeight,
    isOut,
    hasOutPeriChildren,
    hasOutWeightChildren,

    transformStrCache?: string,
    transformStrCacheZ?: string,

    scaleStrText?:      string,
    distScale?:         number,
    dampedDistScale?:   number,
    hasOutChildren:     boolean,
    
    pathes: {
        headof:         Path,
        partof:         Path[],
        finalcolor:     string,
        labelcolor:     string,

        isPartOfAnySelectionPath?: boolean,
        isPartOfAnyHoverPath?:     boolean,
    },

/*
    filter (selection): {},
        layout: {},          ...      
        transformation: {},
    
        culling
    
    */
}


