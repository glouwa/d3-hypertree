import { LayerStack } from './layerstack'

export interface ILayer
{
    name:            string,
    args,
    layerStack?:     LayerStack,
    updateTime?:     number,
    
    attach:          (parent)=> void,
   
    update: {
        parent:         ()=> void,
        data:           ()=> void,
        transformation: ()=> void,
        style:          ()=> void,
    }
}
