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
    // }
    objects: {
        //roots:              N[]
        pathes:             Path[]
        selections:         N[]
        traces:             Trace[]
    }
    layout: {
        type:               LayoutFunction
        weight:             (n:N)=> number
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
            rangeCullingWeight: { min:number, max:number }
            rangeNodes:         { min:number, max:number }
            alpha:              number
        }
        focusExtension:     number        
        maxFocusRadius:     number
        wikiRadius:         number
        maxlabels:          number
        /*labelFilter: {
            type:               string
            cullingRadius:      number
            magic:              number                           // auto by init up
            weight:             (n)=> number
            rangeCullingWeight: { min:number, max:number }
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
        wheelFactor:        number
    }
}


