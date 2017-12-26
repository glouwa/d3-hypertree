import { LayerStack } from './layerstack'

export interface ILayer
{
    name:            string,
    args,
    layerStack?:     LayerStack,
    updateTime?:     number,
    
    attach:          (parent)=> void,
    updateData:      ()=> void,
    updateTransform: ()=> void,
    updateColor:     ()=> void,
/*
    update: {
        parent:         ()=> void,
        content:        ()=> void,
        data:           ()=> void,
        transformation: ()=> void,
        color:          ()=> void,
    }*/
}
