import { LayerStack } from './layerstack'


export interface ILayerView {    
    parent,
    layerstack,
    unitdisk,
    hypertree
}

export interface ILayerArgs {
}

export interface ILayer
{
    name:        string,
    view:        ILayerView,
    args,    
    updateTime?: number,
   
    update: {
        parent:         ()=> void,
        data:           ()=> void,
        transformation: ()=> void,
        style:          ()=> void,
    }
}
