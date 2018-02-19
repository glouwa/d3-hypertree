import { N }                   from '../n/n'
import { Path }                from '../path/path'
import { LoaderFunction }      from '../n/n-loaders'
import { LayoutFunction }      from '../n/n-layouts'
import { Transformation }      from '../../models/transformation/hyperbolic-transformation'
import { TransformationCache } from '../../models/transformation/hyperbolic-transformation'
import { UnitDiskArgs }        from '../../models/unitdisk/unitdisk-model'
import { Hypertree }           from '../../components/hypertree/hypertree'
import { IUnitDisk }           from '../../components/unitdisk/unitdisk'
import { ILayer }              from '../../components/layerstack/layer'

export interface HypertreeArgs
{    
    iconmap:      any,

    dataloader:   (ok: (root:N, t0:number, dl:number)=>void)=> void,    
    langloader:   (lang)=> (ok)=> void,
    
    weight:       (n:N)=> number,
    caption:      (hypertree:Hypertree, n:N)=> string,
    onNodeSelect: (n:N)=> void,
    
    data:         N,
    langmap:      {},
    layout:       LayoutFunction,
    magic:        number,
    decorator:    { new(a: UnitDiskArgs) : IUnitDisk }, // replace by navigation

    objects: {
        pathes:     Path[],
        selections: N[],
    },
    
    geometry: {         // unitdiskModel
        transformation: Transformation<N>,
        cacheUpdate:    (ud:IUnitDisk, cache:TransformationCache)=> void,        
        
        nodeRadius:     (ud:IUnitDisk, n:N)=> number,
        nodeScale:      any,
        nodeFilter:     (n:N)=> boolean,
        linkWidth:      (n:N)=> number,         
        layers:         ((v, ls:IUnitDisk)=> ILayer)[],
        clipRadius:     number,
    }
    //navigation?: {},
    //meta?: {},
}