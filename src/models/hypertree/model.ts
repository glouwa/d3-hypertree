import { N }                   from '../n/n'
import { Path }                from '../path/path'
import { Trace }               from '../trace/trace'
import { LoaderFunction }      from '../n/n-loaders'
import { LayoutFunction }      from '../n/n-layouts'
import { UnitDiskArgs }        from '../unitdisk/unitdisk-model'
import { UnitDiskView }        from '../unitdisk/unitdisk-model'
import { Hypertree }           from '../../components/hypertree/hypertree'
import { IUnitDisk }           from '../../components/unitdisk/unitdisk'
import { ILayer }              from '../../components/layerstack/layer'
import { C }                   from '../transformation/hyperbolic-math'

type Partial<T> = {
    [P in keyof T]?: T[P];
}

export interface HypertreeArgs
{
    //datasource: {
        langmap?:               {} | null                         // node name -> label text, applied once at initialization
        iconmap?:               {} | null                         // node name (or id) -> emoji, applied once at initialization
        dataloader?:            LoaderFunction
        langloader?:            (lang)=> (ok)=> void    
        dataInitBFS:            (ht:Hypertree, n:N)=> void       // emoji, imghref
        langInitBFS:            (ht:Hypertree, n:N)=> void       // text, wiki, clickable, cell, :  auto--> textlen
    objects: {
        //roots:              N[]
        pathes:             Path[]
        selections:         N[]
        traces:             Trace[]
    }
    layout: {
        type:               LayoutFunction
        weight:             (n:N)=> number
        // order of the children in their wedge: 'data' (default, as given) or
        // 'balanced' (the heaviest child in the middle, the others on the lighter
        // side: the heaviest path runs straight, like a spruce; children-order.ts)
        childOrder?:        'data' | 'balanced'
        // the leaf children of a node with many of them in several rows (a
        // staircase), the node the angle of its columns (true, default); false:
        // one row, every leaf its own angle (fan-weight.ts)
        multirowHighDegreeNodes?: boolean
        // shorter links near the root (layoutBergé): the root's children get this part
        // of a link (e.g. .1), the links to the leaves the whole one, linear in between
        // (by the place between root and leaves: (depth − 1) / (depth − 1 + height)).
        // undefined (default): the root's children half, all other links whole
        rootLinkLength?:    number
        initSize:           number
        rootWedge: {
            orientation:    number
            angle:          number
        }
    }
    filter: {
        type:               string
        cullingRadius:      number
        weightFilter: {
            magic?:             number                           // internal: set at initialization so the visible node count is within rangeNodes, then adapted per update
            weight:             (n)=> number
            rangeNodes:         { min:number, max:number }
            alpha:              number
        }
        focusExtension:     number        
        maxFocusRadius:     number
        wikiRadius:         number
        maxlabels:          number
        // the weight of a node when the label layers choose which nodes get a label
        // (times the squared display scale): default its subtree weight
        // (precalc.cullingWeight); e.g. a felt importance from the data. A function
        // returning undefined or null for a node falls back to the subtree weight.
        labelScore?:        (n:N)=> number
        /*labelFilter: {
            type:               string
            cullingRadius:      number
            magic:              number                           // auto by init up
            weight:             (n)=> number
            rangeNodes:         { min:number, max:number }
            alpha:              number                
        }*/
    }       
    geometry:               UnitDiskArgs                      // layer -+
    interaction: {
        mouseRadius:        number,
        // strategies that set the node state (n.hovered, n.selected); layers only show it
        hover?:             'pointer' | 'none'               // default 'pointer': the node under the mouse
        selection?:         'none' | 'single' | 'multi'      // default 'multi'; 'single': a new selection replaces the old one
        maxSelections?:     number                           // 'multi': the oldest selection is dropped beyond this (default 10)
        clickAction?:       'select' | 'goto' | 'none'       // what a click does besides onNodeClick (default 'none')
        onNodeClick?:       (n:N, m:C, l:ILayer)=> void
        // every selection change (api.toggleSelection/select/deselect/clearSelection,
        // clickAction 'select', replaced or dropped selections); selected = new state
        onNodeSelect:       (n:N, selected?:boolean)=> void
        // pointer pressed on a node for holdDuration ms without moving; no click follows
        onNodeHold:         (n:N, m:C, l:ILayer)=> void
        holdDuration?:      number
        // node under the mouse changed (undefined when leaving the tree)
        onNodeHover:        (n:N)=> void
        onHoverNodeChange?: (n:N)=> void
        onCenterNodeChange: (n:N, s:string)=> void
        λbounds:            [ number, number ]
        // the tree never fills less than this share of the disk radius (e.g. .9): the
        // lower λ bound is computed per tree after loading (the smallest λ at which,
        // with the root in the middle, the farthest node reaches it), replacing λbounds[0]
        minFill?:           number
        // a normal link with its parent in the middle of the disk is at most this long
        // (share of the disk radius, e.g. .5): the upper λ bound, replacing λbounds[1]
        // (in layoutBergé such a link is λ long; leaves among many siblings are staggered
        // outward with an extra length and do not count)
        maxLinkLength?:     number
        wheelFactor:        number
    }
}


