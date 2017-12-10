import * as d3       from 'd3'
import { N }         from '../../models/n/n'
import { IUnitDisk } from '../unitdisk/unitdisk'

export interface ILayer
{
    name:            string,
    attach:          (parent)=> void,
    updateData:      ()=> void,
    updateTransform: ()=> void,
    updateColor:     ()=> void,
}

export interface LayerStackArgs
{
    parent,
    unitdisk: IUnitDisk
}

export class LayerStack
{
    args: LayerStackArgs

    layersGroup:    any

    focus:          ILayer
    cells:          ILayer // set on create
    links:          ILayer
    nodes:          ILayer
    captions:       ILayer
    specials:       ILayer

    constructor(args: LayerStackArgs)
    {
        this.args = args
        this.layersGroup = this.args.parent.append('g')
        this.updateLayers()
    }

    private updateLayers() : void
    {
        for (var layerfactoryfunc of this.args.unitdisk.args.layers)
        {
            var argscpy = Object.assign({ parent:this.layersGroup }, this.args.unitdisk)
            var newL = layerfactoryfunc(this.args.unitdisk)
            this[newL.name] = newL // todo newL.args is a workaround

            if (newL.attach) 
                newL.attach(this.layersGroup)
        }
    }

    public updateTransformation()
    {
        if (this.focus) this.focus.updateData()

        var t0 = performance.now()
        if (this.cells) this.cells.updateData()

        var t1 = performance.now()
        if (this.links) this.links.updateData()

        var t2 = performance.now()
        if (this.nodes) this.nodes.updateData()

        var t3 = performance.now()
        if (this.captions) this.captions.updateData()

        var t4 = performance.now()
        if (this.specials) this.specials.updateData()

        if (this.args.unitdisk.cache.unculledNodes.length != 3)
            this.args.unitdisk.args.hypertree.infoUi.updateD3Info(
                10, [t1-t0, t2-t1, t3-t2, performance.now() - t3], this.args.unitdisk.cache)
    }

    public updatePath()
    {
        if (this.cells)    this.cells.updateData()
        if (this.links)    this.links.updateColor()
        if (this.nodes)    this.nodes.updateColor()
        if (this.captions) this.captions.updateData()
        //Materialize.toast("updatePath", 2500)
    }
}
