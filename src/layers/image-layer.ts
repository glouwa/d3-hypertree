import { N }               from '../data/n'
import { ILayer, ILayerArgs, LayerContext, LayerType, layerData } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'

export interface ImageLayerArgs extends ILayerArgs
{
    width?:     number,
    height?:    number,
    imagehref?: (d:N)=> string,
}

// Images of nodes with precalc.imageHref, centered on the node, scaled with the distance.
export class ImageLayer implements ILayer
{
    static type : LayerType<ImageLayerArgs> = {
        defaults: ()=> ({
            invisible:  false,
            hideOnDrag: false,
            data:       'images',
            width:      .05,
            height:     .05,
            imagehref:  (d:N)=> d.precalc.imageHref,
        }),
        create: (ctx, name, args)=> new ImageLayer(ctx, name, args),
    }

    view:             LayerContext
    args:             ImageLayerArgs
    d3updatePattern:  D3UpdatePattern
    name:             string
    needs = <const>['data', 'transform']
    update = {
        parent:         ()=> this.attach(),
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:LayerContext, name:string, args:ImageLayerArgs) {
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
            className:         'node',
            elementType:       'image',
            create:            s=> s.attr('xlink:href', d=> this.args.imagehref(d))
                                    .attr('width', this.args.width)
                                    .attr('height', this.args.height),
            updateColor:       s=> {},
            updateTransform:   s=> s.attr("transform", (d:N)=> {
                // centered on the node: half the image size back, scaled with the distance
                const dx = -this.args.width * d.distScale / 2, dy = -this.args.height * d.distScale / 2
                return ` translate(${dx} ${dy})`
                    + ` translate(${d.cache.re} ${d.cache.im})`
                    + ` scale(${d.distScale})`
            })
        })
    }
}
