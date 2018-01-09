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
