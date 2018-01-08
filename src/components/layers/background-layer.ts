import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern }    from '../layerstack/d3updatePattern'

interface U
{
    all:    ()=>void
    parent: ()=>void
}

interface M
{
}

interface View<V, U=U, VParent=V>
{
    parent:   VParent,
    children: ()=> View<any, U>,
}

class C<M, V, VParent>
{
    public model:   M 
    public api:     {}
    private view:   V    
    private update: U

    constructor(view:V, model:M)
    {
        this.model = model
        this.view = view
    }
}

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