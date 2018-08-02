import { N }                   from '../n/n'
import { Path }                from '../path/path'
import { Trace }               from '../trace/trace'
import { LoaderFunction }      from '../n/n-loaders'
import { LayoutFunction }      from '../n/n-layouts'
import { UnitDiskArgs }        from '../unitdisk/unitdisk-model'
import { UnitDiskView }        from '../unitdisk/unitdisk-model'
import { Hypertree }           from '../../components/hypertree/hypertree'
import { IUnitDisk }           from '../../components/unitdisk/unitdisk'

export interface HypertreeArgs
{
    data:                   N,
    langmap:                {},
    dataloader:             LoaderFunction
    langloader:             (lang)=> (ok)=> void
    iconmap:                any
    caption:                (hypertree:Hypertree, n:N)=> string
    captionBackground:      'all' | 'center' | 'none'        // x 
    captionFont:            string

    objects: {  
        pathes:             Path[]
        selections:         N[]
        traces:             Trace[]
    }
    layout: {
        type:               LayoutFunction
        weight:             (n:N)=> number                   // x 
        initMaxλ:           number
        rootWedge: {    
            orientation:    number
            angle:          number
        }   
    }   
    filter: {   
        type:               string
        cullingRadius:      number
        magic:              number                           // auto by init up
        weight:             (n)=> number                     // x 
        rangeCullingWeight: { min:number, max:number }
        rangeNodes:         { min:number, max:number }
        alpha:              number
        focusExtension:     number        
        maxFocusRadius:     number
        maxlabels:          number
        wikiRadius:         number
    }       
    geometry:               UnitDiskArgs                      // layer -+
    interaction: {  
        mouseRadius:        number,
        onNodeSelect:       (n:N)=> void
        onNodeHold:         ()=>void                          // x 
        onNodeHover:        ()=>void                          // x 
        λbounds:            [ number, number ]
        wheelFactor:        number
    }
}

export interface HypertreeArgs_Soll
{    
    model: {
        data:            N
        langmap:         {}
        dataloader:      (ok: (root:N, t0:number, dl:number)=>void)=> void
        langloader:      (lang)=> (ok)=> void
        caption:         (hypertree:Hypertree, n:N)=> string
        iconmap:         any
    }
    objects: {
        root:            N
        selections:      N[]
        pathes:          Path[]
        traces:          Trace[]
    }
    layout: {
        type:            LayoutFunction
        weight:          (n:N)=> number
        rootWedge: {
            orientation: number
            angle:       number
        }
    }
    transformation: {
        type:            { new(view:UnitDiskView, args:UnitDiskArgs) : IUnitDisk }
        P:               { re: 0, im:.5 },
        θ:               { re: 1, im:0 },
        λ:               'auto(.75)'
    }
    filter: {
        magic:           number,
    }    
    interaction: {        
        onNodeSelect:    (n:N)=> void,
        onNodeHold:     ()=> {},                    
        onNodeHover:    ()=> {},
        λbounds:        [.1, .8],
        wheelFactor:    1.175,
    }
    geometry:            UnitDiskArgs
}