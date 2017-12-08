import { ILayer }        from '../index'
import { D3UpdateLayer } from '../index'

export interface InteractionLayerArgs
{
    unitdisk    
}

export class InteractionLayer implements ILayer
{
    name: string
    args: InteractionLayerArgs    
    updateData =      ()=> {}
    updateTransform = ()=> {}
    updateColor =     ()=> {}

    constructor(args : InteractionLayerArgs) {        
        this.args = args
        this.name = 'interaction'
    }

    public attach(parent) {
        
    }
}

