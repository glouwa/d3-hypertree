import { LayerStack } from './layerstack'
import { UnitDisk }   from '../../d3-hypertree';
import { Hypertree }  from '../../d3-hypertree';

export interface ILayerView 
{
    parent,
    layerstack:LayerStack,
    unitdisk:UnitDisk,
    hypertree:Hypertree
}

export interface ILayerArgs
{
    invisible?: boolean,
    hideOnDrag?: boolean,
}

export interface ILayer
{    
    view: ILayerView,
    args,    
    name: string,
   
    update: {
        parent:         ()=> void,
        data:           ()=> void,
        transformation: ()=> void,
        style:          ()=> void,
    }
}
