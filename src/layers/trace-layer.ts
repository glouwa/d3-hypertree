import { ILayer, ILayerArgs, LayerContext, LayerType, layerData } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'

export interface TraceLayerArgs extends ILayerArgs
{
}

// The traces of the pointers (objects.traces) as polylines; a debugging aid.
export class TraceLayer implements ILayer
{
    static type : LayerType<TraceLayerArgs> = {
        defaults: (ctx)=> ({
            invisible:  true,
            hideOnDrag: true,
            data:       ()=> ctx.model.objects.traces,
        }),
        create: (ctx, name, args)=> new TraceLayer(ctx, name, args),
    }

    view:            LayerContext
    args:            TraceLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
    needs = <const>['data', 'transform']
    update = {
        parent:         ()=> this.attach(),
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:LayerContext, name:string, args:TraceLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              ()=> layerData(this.view, this.args.data, this),
            name:              this.name,
            className:         'trace-polyline',
            elementType:       'polyline',
            create:            s=> {},
            updateColor:       s=> {},
            updateTransform:   s=> s.attr("points", d=> d.points
                .map(e=> `${e.re}, ${e.im}`)
                .join(' ')
            )
        })
    }
}
