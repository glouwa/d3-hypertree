import { UnitdiskMeta } from '../unitdisk-meta/unitdisk-meta'
import { LayerStackMeta } from '../layerstack-meta/layerstack-meta'

export class HypertreeMeta 
{
    private view
    private model
    private udView     : UnitdiskMeta
    private udNav      : UnitdiskMeta
    private lsView     : LayerStackMeta
    private lsNav      : LayerStackMeta
    private lsNavParam : LayerStackMeta

    constructor({ view, model }) {
        this.view = view
        this.model = model
        this.updateParent()
    }

    update = {
        parent: ()=> this.updateParent(),
        all:    ()=> this.update.data(),        
        data:   ()=> this.updateData()
    }

    private updateParent() {   
        
        this.udView = new UnitdiskMeta({ 
            view: { parent:this.view.parent, className:'data' },
            model: this.model
        })
       
        this.lsView = new LayerStackMeta({
            view: { parent:this.view.parent, className: 'data' },
            model: this.model.unitdisk
        })
        if (this.model.unitdisk.navParameter)
            this.lsNavParam = new LayerStackMeta({
                view: { parent:this.view.parent, className: 'nav' },
                model: this.model.unitdisk.navParameter
            }) 
    }

    private updateData() {        
    }
}