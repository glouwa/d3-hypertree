import { N }               from '../data/n'
import { ILayer, ILayerArgs, LayerContext, LayerType, layerData } from '../view/layer'
import { D3UpdatePattern } from '../view/d3-join'
import { sizeAt }          from './label-geometry'
import { textImage }       from './label-layer'

export interface EmojiBackgroundLayerArgs extends ILayerArgs
{
    className?:   string,
    emojiLayer?:  string,                   // the emoji layer it lies under: its scale and its emojis' size
    padding?:     number,                   // the disk's radius: half the emoji's larger side times this
    fill?:        (d:N)=> any,              // default: the theme (class emoji-background)
    stroke?:      (d:N)=> any,
}

// A disk with a border under every emoji (the emoji layer's data, centered on the
// node like the emojis), as large as the emoji: the emoji stands out on links and
// cells. Off by default.
export class EmojiBackgroundLayer implements ILayer
{
    static type : LayerType<EmojiBackgroundLayerArgs> = {
        defaults: ()=> ({
            invisible:   true,
            hideOnDrag:  false,
            className:   'emoji-background',
            data:        'emojis',
            emojiLayer:  'emojis',
            padding:     1.2,
            fill:        n=> undefined,
            stroke:      n=> undefined,
        }),
        create: (ctx, name, args)=> new EmojiBackgroundLayer(ctx, name, args),
    }

    view:            LayerContext
    args:            EmojiBackgroundLayerArgs
    d3updatePattern: D3UpdatePattern
    name:            string
    needs = <const>['data', 'transform']
    update = {
        parent:         ()=> this.attach(),
        data:           ()=> this.d3updatePattern.update.data(),
        transformation: ()=> this.d3updatePattern.update.transformation(),
        style:          ()=> this.d3updatePattern.update.style()
    }

    constructor(view:LayerContext, name:string, args:EmojiBackgroundLayerArgs) {
        this.view = view
        this.args = args
        this.name = name
    }

    private emojiArgs() {
        const layer = this.view.layerstack.layers && this.view.layerstack.layers[this.args.emojiLayer]
        return layer ? layer.args : {}
    }

    // the radius before the scale: half the larger side of the emoji's bitmap (the
    // emoji layer's, measured once per emoji), times padding
    private radius(group:Element, d:N) : number {
        const e = this.emojiArgs()
        const linux = navigator.platform.includes('inux')
        const text = e.text ? e.text(d) : d.precalc.icon
        const image = text ? textImage(group, (e.className || 'caption') + (linux ? ' caption-icon' : ''), text, true) : undefined
        const half = image ? Math.max(image.w, image.h) / 2 : .025
        return half * this.args.padding
    }

    // at the node, scaled like the emoji (its scale, geometry.shrinkAtRim, twice the label size)
    private transform(d:N) : string {
        const k = sizeAt(this.view, this.emojiArgs().scale, d) * 2
        return `translate(${d.cache.re} ${d.cache.im}) scale(${k})`
    }

    private attach() {
        const $this = this
        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            data:              ()=> layerData(this.view, this.args.data, this),
            name:              this.name,
            className:         this.args.className,
            elementType:       'circle',
            create:            s=> s.each(function(d:N) { this.setAttribute('r', String($this.radius(this.parentNode, d))) })
                                    .style("fill",   d=> this.args.fill(d))
                                    .style("stroke", d=> this.args.stroke(d)),
            updateColor:       s=> s,
            updateTransform:   s=> s.attr("transform", d=> this.transform(d)),
        })
    }
}
