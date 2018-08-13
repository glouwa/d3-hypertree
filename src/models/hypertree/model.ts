import { N }                   from '../n/n'
import { Path }                from '../path/path'
import { Trace }               from '../trace/trace'
import { LoaderFunction }      from '../n/n-loaders'
import { LayoutFunction }      from '../n/n-layouts'
import { UnitDiskArgs }        from '../unitdisk/unitdisk-model'
import { UnitDiskView }        from '../unitdisk/unitdisk-model'
import { Hypertree }           from '../../components/hypertree/hypertree'
import { IUnitDisk }           from '../../components/unitdisk/unitdisk'

type Partial<T> = {
    [P in keyof T]?: T[P];
}

/*
    //  github page
    header {
        background: #363636f0;
    }
    #banner {
        background: hsla(48, 95%, 54%, 1);
    }
    body {    
        background: #ecebe1;
    }
    header h1 {    
        text-shadow: 0px 2px 0px rgba(179, 179, 179, 0.28);
    }
    #banner .button {
        border: 0px solid #dba500; 
        background-color: hsla(48, 100%, 74%, 1);
    }
*/

export interface HypertreeArgs
{
    //datasource: {
        langmap?:               {} | null
        dataloader?:            LoaderFunction
        langloader?:            (lang)=> (ok)=> void    
        dataInitBFS:            (ht:Hypertree, n:N)=> void       // emoji, imghref
        langInitBFS:            (ht:Hypertree, n:N)=> void       // text, wiki, clickable, cell, :  auto--> textlen
    // }
    objects: {
        roots:              N[]
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
            magic:              number                           // auto by init up
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
        //type:               'clickonly' | 'selction' | 'multiselection' | 'centernodeselectable'
        mouseRadius:        number,
        onNodeSelect:       (n:N)=> void
        onNodeHold:         ()=>void                          // x 
        onNodeHover:        ()=>void                          // x 
        λbounds:            [ number, number ]
        wheelFactor:        number
    }
}
