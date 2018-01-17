import { LayerStack } from './layerstack'
import { UnitDisk }   from '../../index';
import { Hypertree }  from '../../index';

export interface ILayerView 
{
    parent,
    layerstack:LayerStack,
    unitdisk:UnitDisk,
    hypertree:Hypertree
}

export interface ILayerArgs 
{
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
