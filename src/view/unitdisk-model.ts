import { Hypertree }               from '../hypertree'
import { N }                       from '../data/n'
import { C }                       from '../geometry/hyperbolic-math'
import { Transformation }          from '../navigation/transformation'
import { HypertreeArgs }           from '../config/schema'
import { Projection }              from '../projection/projection'

export interface UnitDiskView
{
    parent:            any,
    position:          string,
    className:         string,
    hypertree:         Hypertree,
}

/** What the unit disk (the host of the layers) draws: the tree, in the model's geometry, through a projection. */
export interface UnitDiskArgs
{
    data?:             N
    transformation:    Transformation<N>
    transform:         (n:N)=> C             // the transformed disk position of a node
    model:             HypertreeArgs         // the resolved model
    projection:        Projection
}
