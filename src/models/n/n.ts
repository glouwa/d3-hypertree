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

export interface Path {    
    type:      string,
    id:        string,
    icon:      string,
    head:      N,
    headName:  string,
    ancestors: N[],
    color:     string
}

/*export class Path {    
    type:      string
    id:        string
    icon:      string
    head_:     N
    headName:  string
    ancestors: N[]
    color:     string

    constructor()
    {

    }

    get head(){
        return this.head
    }

    set head(h)
    {
        this.head_ = h
        // remove old
        // add new
    }

    remove()
    
}*/ 

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
    label:              string,
    txt:                string,
    icon:               string,
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

    pathes: {
        headof:         Path,
        partof:         Path[],
        finalcolor:     string,
        labelcolor:     string
    },

    /*
    constants: {           alles on load
        weights, weightscale.        
        labels, len, txt icon, img,

    },  

    pathes: {
        isPartOfPath:  N[],
        colors:        string[],
    }

    selection: {},
        layout: {},          ...      
        transformation: {},
    
        culling
    
    */
}


