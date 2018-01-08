import { LayerStack } from './layerstack'


export interface ILayerView {    
    parent,
    layerstack
}

export interface ILayerArgs {
}

export interface ILayer
{
    name:        string,
    args,
    layerStack?: LayerStack,
    updateTime?: number,
   
    update: {
        parent:         ()=> void,
        data:           ()=> void,
        transformation: ()=> void,
        style:          ()=> void,
    }
}
