import { ILayer, ILayerArgs, LayerContext, LayerType } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'
import { C }               from '../geometry/hyperbolic-math'

export interface FocusLayerArgs extends ILayerArgs
{
    className?: string,
    r:          (ctx:LayerContext)=> number,   // the radius of the disk circle
    center:     (ctx:LayerContext)=> C,        // its center (disk coordinates)
}

// An indicator circle of the disk (the culling radius, the focus, the λ circle, ...),
// drawn as the projection's image of that circle.
export class FocusLayer implements ILayer
{
    static type : LayerType<FocusLayerArgs> = {
        defaults: ()=> ({
            invisible:  true,
            hideOnDrag: true,
            className:  'focus-circle',
            r:          ()=> 1,
            center:     ()=> ({ re: 0, im: 0 }),
        }),
        create: (ctx, name, args)=> new FocusLayer(ctx, name, args),
    }

    view:             LayerContext
    args:             FocusLayerArgs
    d3updatePattern:  D3UpdatePattern
    name:             string
    needs = <const>['data', 'transform']
    update = {
        parent:         ()=> this.attach(),
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:LayerContext, name:string, args:FocusLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    private transform() : string {
        const v = this.view.projection.circle(this.args.center(this.view), this.args.r(this.view))
        return v ? `translate(${v.cx} ${v.cy}) scale(${v.r})` : 'translate(0 0) scale(0)'
    }

    private attach() {
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              [1],
            name:              this.name,
            className:         this.args.className,
            elementType:       'circle',
            create:            s=> s.attr('r', 1),
            updateColor:       s=> {},
            updateTransform:   s=> s.attr('transform', this.transform()),
        })
    }
}
