import { C, Cp }         from '../../hyperbolic-math'
import { HierarchyNode } from 'd3'

/*
export interface NavObject {
}

export interface File {    
    io {
        read,
        write,
    }
}

export interface TreeFile   extends File {} // folderstructure, skos...
export interface StringFile extends File {}

export interface Species {
    name:string,
    numLeafs:number,
    ottId:string,
    hasWiki:boolean,
}

//HierarchyNode<Datum>
*/

export interface N {    
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

    sum,

//  labels
    label:              number,
    labellen:           number

//layout
    z?:                 C,

//cahce
    cache?:             C,
    cachep?:            Cp,
    strCache?:          string,
    isOutλ,
    isOut99,
    transformStrCache?: string,
    scaleStrText?:      string,
    distScale?:         number,
    dampedDistScale?:   number,
    weightScale?:       number,
    hasOutChildren:     boolean,

// selection
    isSelected?:        N,
    isHovered?:         N,


}


