import { N, Path }        from '../n/n'
import { LoaderFunction } from '../n/n-loaders'
import { LayoutFunction } from '../n/n-layouts'
import { Transformation } from '../../hyperbolic-transformation'

import { Hypertree }      from '../../components/hypertree/hypertree'
import { IUnitDisk }      from '../../components/unitdisk/unitdisk'
import { UnitDiskArgs }   from '../../components/unitdisk/unitdisk'
import { ILayer }         from '../../components/layerstack/layer'

export interface HypertreeArgs
{    
    iconmap:      any,

    dataloader:   (ok: (root:N, t0:number, dl:number)=>void)=> void,    
    langloader:   (lang)=> (ok)=> void,
    weight:       (n:N) => number,
    caption:      (hypertree:Hypertree, n:N)=> string,
    onNodeSelect: (n:N)=> void,
    
    data:         N,
    langmap:      {},    
    layout:       LayoutFunction,
    magic:        number,
    decorator:    { new(a: UnitDiskArgs) : IUnitDisk },

    objects: {
        pathes:     Path[],
        selections: N[],
    },   
    
    geometry: {
        clipRadius:     number,
        nodeRadius:     number,
        transformation: Transformation<N>,
        cacheUpdate:    (cache:IUnitDisk)=> void,        
        layers:         ((ls:IUnitDisk)=> ILayer)[],
    }
}