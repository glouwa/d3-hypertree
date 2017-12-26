import { LayerStack } from './layerstack'

export interface ILayer
{
    name:            string,
    args,
    updateTime?:     number,
    layerStack?:     LayerStack,

    attach:          (parent)=> void,
    updateData:      ()=> void,
    updateTransform: ()=> void,
    updateColor:     ()=> void,
}
