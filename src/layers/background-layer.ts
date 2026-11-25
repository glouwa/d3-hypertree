import { ILayer, ILayerArgs, LayerContext, LayerType } from '../view/layer'
import { D3UpdatePattern }    from '../view/d3-join'

export interface BackgroundLayerArgs extends ILayerArgs
{
}

// The background of the plane: what the projection draws (the disk with its gradient,
// the half-plane with a grid).
export class BackgroundLayer implements ILayer
{
    static type : LayerType<BackgroundLayerArgs> = {
        defaults: ()=> ({ invisible: false, hideOnDrag: false }),
        create:   (ctx, name, args)=> new BackgroundLayer(ctx, name, args),
    }

    view:            LayerContext
    args:            BackgroundLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
    needs = <const>['data']
    update = {
        parent:         ()=> this.attach(),
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:LayerContext, name:string, args:BackgroundLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    private attach() {
        const bg = this.view.projection.background()
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              [1],
            name:              this.name,
            className:         bg.className,
            elementType:       bg.elementType,
            create:            bg.create,
            updateColor:       s=> {},
            updateTransform:   s=> {},
        })
    }
}
