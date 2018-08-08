import { ILayer }                  from '../../components/layerstack/layer'
import { IUnitDisk }               from '../../components/unitdisk/unitdisk'
import { Hypertree }               from '../../components/hypertree/hypertree'

import { N }                       from '../n/n'
import { C }                       from '../transformation/hyperbolic-math'
import { Transformation }          from '../transformation/hyperbolic-transformation'
import { TransformationCache }     from '../transformation/hyperbolic-transformation'
import { ArcCurvature }            from '../../components/layers/link-layer';

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
    transform?:        (n:N)=> C,

    decorator:         { new(view:UnitDiskView, args:UnitDiskArgs) : IUnitDisk },
    transformation:    Transformation<N>,    
    cacheUpdate:       (ud:IUnitDisk, cache:TransformationCache)=> void,    
    layers:            ((v, ls:IUnitDisk)=> ILayer)[],

    nodeRadius:        (ud:IUnitDisk, n:N)=> number,
    nodeScale,
    nodeFilter:        (n:N)=> boolean,
    linkWidth:         (n:N)=> number,
    linkCurvature:     ArcCurvature,
    offsetEmoji:       (d, i, v)=> C,
    offsetLabels:      (d, i, v)=> C,
    clipRadius:        number
    captionBackground: 'all' | 'center' | 'none'        // x 
    captionFont:       string
}
