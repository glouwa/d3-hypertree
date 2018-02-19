import { ILayer }                  from '../../components/layerstack/layer'
import { IUnitDisk }               from '../../components/unitdisk/unitdisk'
import { Hypertree }               from '../../components/hypertree/hypertree'

import { N }                       from '../../models/n/n'
import { C }                       from '../../models/transformation/hyperbolic-math'
import { Transformation }          from '../../models/transformation/hyperbolic-transformation'
import { TransformationCache }     from '../../models/transformation/hyperbolic-transformation'

export interface UnitDiskView
{
    parent:            any,
    position:          string,
    className:         string,
    hypertree:         Hypertree,
}

export interface UnitDiskArgs
{
    data?:             N,

    transformation:    Transformation<N>,
    cacheUpdate:       (ud:IUnitDisk, cache:TransformationCache)=> void,    
    transform?:        (n:N)=> C,

    nodeRadius:        (ud:IUnitDisk, n:N)=> number,
    nodeScale,
    nodeFilter:        (n:N)=> boolean,
    linkWidth:         (n:N)=> number,
    layers:            ((v, ls:IUnitDisk)=> ILayer)[],
    clipRadius?:       number
}
