import { ILayer }                  from '../../components/layerstack/layer'
import { IUnitDisk }               from '../../components/unitdisk/unitdisk'
import { Hypertree }               from '../../components/hypertree/hypertree'

import { N }                       from '../../models/n/n'
import { C }                       from '../../models/transformation/hyperbolic-math'
import { Transformation }          from '../../models/transformation/hyperbolic-transformation'
import { TransformationCache }     from '../../models/transformation/hyperbolic-transformation'

export interface UnitDiskArgs
{
    parent:            any,
    position:          string,
    className:         string,
    hypertree:         Hypertree,
    data:              N,
    layers:            ((v, ls:IUnitDisk)=> ILayer)[],

    transformation:    Transformation<N>,
    cacheUpdate:       (ud:IUnitDisk, cache:TransformationCache)=> void,    
    transform:         (n:N)=> C,

    caption:           (n:N)=> string,
    nodeRadius:        (ud:IUnitDisk, n:N)=> number,
    nodeScale,
    nodeFilter:        (n:N)=> boolean,
    linkWidth:         (n:N)=> number,
    clipRadius?:       number
}
