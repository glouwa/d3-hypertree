import { UnitdiskMeta }   from '../unitdisk-meta/unitdisk-meta'
import { LayerStackMeta } from '../layerstack-meta/layerstack-meta'
import { Hypertree }      from '../../hypertree/hypertree'
import { UnitDiskNav } from '../../../index';

export class NoHypertreeMeta
{
    public update = {
        parent:         ()=> {},
        model:          ()=> {},
        layout:         ()=> {},
        transformation: ()=> {}
    }
}

export class HypertreeMeta
{
    private view
    private model      : Hypertree
    private udView     : UnitdiskMeta    
    private lsView     : LayerStackMeta
    
    constructor({ view, model }) {
        this.view = view
        this.model = model
        this.updateParent()
    }

    update = {
        parent: ()=> this.updateParent(),    
        all: ()=> {
// TODO:
        }, 
        model: ()=> {
            this.udView.update.model() 
            this.lsView.update.data()
        },
        layout: ()=> {
            this.udView.update.layout()           
            this.lsView.update.data()
        },
        transformation: ()=> {
            this.udView.update.transformation() 
            this.lsView.update.data()
        }
    }

    private updateParent() {   
        
        this.udView = new UnitdiskMeta({ 
            view: { parent:this.view.parent, className:'data' },
            model: this.model.unitdisk
        })
        
        this.lsView = new LayerStackMeta({
            view: { parent:this.view.parent, className: 'data' },
            model: this.model.unitdisk
        })
    }
}

export class HypertreeMetaNav
{
    private view
    private model      : Hypertree
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
        parent:         ()=> this.updateParent(),        
        model:          ()=> {
            this.udView.update.model() 
            this.udNav.update.model() 
            this.lsView.update.data()
            this.lsNav.update.data()
            this.lsNavParam.update.data()
        },
        layout:         ()=> {
            this.udView.update.layout()           
            this.udNav.update.layout()           
            this.lsView.update.data()
            this.lsNav.update.data()
            this.lsNavParam.update.data()
        },
        transformation: ()=> {
            this.udView.update.transformation() 
            this.udNav.update.transformation()           
            this.lsView.update.data()
            this.lsNav.update.data()
            this.lsNavParam.update.data()
        }
    }

    private updateParent() {   
        
        this.udView = new UnitdiskMeta({ 
            view: { parent:this.view.parent, className:'data' },
            model: (<UnitDiskNav>this.model.unitdisk).view
        })

        this.udNav = new UnitdiskMeta({ 
            view: { parent:this.view.parent, className:'nav' },
            model: (<UnitDiskNav>this.model.unitdisk).navParameter
        })
        
        this.lsView = new LayerStackMeta({
            view: { parent:this.view.parent, className: 'data' },
            model: (<UnitDiskNav>this.model.unitdisk).view
        })
        
        this.lsNav = new LayerStackMeta({
            view: { parent:this.view.parent, className: 'navBg' },
            model: (<UnitDiskNav>this.model.unitdisk).navBackground
        })

        this.lsNavParam = new LayerStackMeta({
            view: { parent:this.view.parent, className: 'nav' },
            model: this.model.unitdisk.navParameter
        }) 
    }
}

