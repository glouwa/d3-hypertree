import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern }    from '../layerstack/d3updatePattern'

export interface BackgroundLayerArgs extends ILayerArgs
{    
}

export class BackgroundLayer implements ILayer
{    
    view:            ILayerView
    args:            BackgroundLayerArgs
    d3updatePattern: D3UpdatePattern
    name =           'background'
    update = {
        parent:         ()=> this.attach(),      
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:ILayerView, args:BackgroundLayerArgs) {
        this.view = view
        this.args = args
    }

    private attach() {
        // half-plane view: the half-plane above the border (view y = 1), wide enough for
        // any aspect ratio of the view
        if (this.view.hypertree.args.geometry.halfPlane) {
            this.d3updatePattern = new D3UpdatePattern({
                parent:            this.view.parent,
                layer:             this,
                data:              [1],
                name:              this.name,
                className:         'background-halfplane',
                elementType:       'rect',
                create:            s=> s.attr('x', -20).attr('y', -2).attr('width', 40).attr('height', 3)
                                        .attr('fill', 'rgba(128,128,128,.07)')
                                        .attr('stroke', 'rgba(128,128,128,.5)').attr('stroke-width', .003),
                updateColor:       s=> {},
                updateTransform:   s=> {},
            })
            return
        }
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              [1],
            name:              this.name,
            className:         'background-circle',
            elementType:       'circle',
            create:            s=> s.attr('r', 1)
                                    .attr('fill', 'url(#exampleGradient)'),
            updateColor:       s=> {},
            updateTransform:   s=> {},
        })
    }
}