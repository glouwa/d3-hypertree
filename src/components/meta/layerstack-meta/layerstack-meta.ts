import * as d3  from 'd3'
import { HTML } from 'ducd'
import { ILayer } from '../../layerstack/layer'
import { IUnitDisk } from '../../unitdisk/unitdisk'

export class LayerStackMeta
{
    private view
    private model : IUnitDisk
    private ui    : LayerStackMetaUi

    constructor({ view, model }) {
        this.view = view
        this.model = model
        this.updateParent()
    }

    update = {
        parent: ()=> this.updateParent(),
        data: ()=> {             
            this.ui.updateSwitch(this.model.args.hypertree.isAnimationRunning())
            this.ui.updateCounts(this.model.args.hypertree.isAnimationRunning())
        }
    }

    private updateParent() {

        this.ui = LayerInfo_({
            parent: this.view.parent,            
            className: this.view.className,
            //onCheckChange: ()=> this.model.layerStack.updateLayers()
            onCheckChange: ()=> this.model.layerStack.updateTransformation()
        })

        for (var l in this.model.layerStack.layers)            
            this.ui.addCheckboxes(this.model.layerStack.layers[l])    

        this.ui.addSwitch()
    }
}
var labelHtml  = (id)=>     `<div class="label"></div> `
var countHtml  = (id)=>     `<div class="nodes"></div> `
var switchHtml = (id)=>     `<div class="switch"></div> `
var check1Html = (id, c)=>  `<div class="cbx">           
                                <input type="checkbox" id="${id}" class="filled-in" ${c?'checked':''}/>
                                <label for="${id}"></label>
                             </div>`
var barHtml    = (id)=>     `<div class="bar-bg"><div class="bar"></div></div>`
var html       =            `<div class="layer-info"></div>`

interface LayerStackMetaUi extends HTMLElement 
{
    updateSwitch,
    updateCounts,
    addSwitch,
    addCheckboxes
}

export function LayerInfo_({ parent, onCheckChange, className })
{
    var ui = HTML.parse<LayerStackMetaUi>(html)()
    ui.classList.add(className)
    parent.appendChild(ui)
    
    var rows = []
    var cols = ['name', 'type', 'count', 'time', 'enabled']
 
    var colores = d3.schemeCategory10
    var colores = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];
    
    const maxElementCount = 300        
    const maxElementCountGlobal = 1000        
    const maxTimeLayer = 20
    const maxTimeLayerstack = 25

    var sum = 0
    var sumtime = 0
    

    var  pos = 0
    var cc = 0
    ui.addCheckboxes = function(layer) {

        var ccidx = (colores.length+cc++)%colores.length
        var name = layer.name        
        var checked =  ()=> !layer.args.invisible
        var checked2 = ()=> !layer.args.hideOnDrag
        var count =    ()=> (layer.d3updatePattern && layer.d3updatePattern.data ? layer.d3updatePattern.data.length : 1)        
        var type =     ()=> (layer.args.elementType?layer.args.elementType.length:'')

        const layerViews = {
            label:       HTML.parse<HTMLElement>(labelHtml(pos))(),
            count:       HTML.parse<HTMLElement>(countHtml(pos))(),
            checkNormal: HTML.parse<HTMLElement>(check1Html(`pos-${className}-${pos}-normal`, checked()))(),
            checkDrag:   HTML.parse<HTMLElement>(check1Html(`pos-${className}-${pos}-drag`, checked2()))(),
            bar:         HTML.parse<HTMLElement>(barHtml(pos))(),
            updateCounts: (animationRunning) => {     
                var checker = animationRunning ? checked2() : checked()                
                var count_ = checker ? count() : 0
                sum += count_
                
                layerViews.count.innerHTML = checker?`${count_} ${type()}`:``                                  
        
                const lsmeta = layer.layerStack.d3meta
                console.assert(layer.name)
                const pos = lsmeta.names.indexOf(layer.name)
                const time = lsmeta.Δ[pos] 
                const maxLayerTime = 20

                sumtime += time

                layerViews.bar.children[0].style.width = (time/maxLayerTime*100)+'%'
                layerViews.bar.children[0].style.backgroundColor = colores[ccidx]
            }
        }
        rows.push(layerViews)

        ui.appendChild(layerViews.label)
        ui.appendChild(layerViews.count)
        ui.appendChild(layerViews.checkNormal)
        ui.appendChild(layerViews.checkDrag)
        ui.appendChild(layerViews.bar)
        
        ui.children[pos].innerHTML = name
        layerViews.checkNormal.querySelector('input').onchange = function() {            
            function updateCheck(checkBox, layer:ILayer, layerViews) {        
                // on change
                layer.args.invisible = !layer.args.invisible                
                onCheckChange()   
                ui.updateCounts()             
            }
            // on create?
            updateCheck(this, layer, layerViews)
        }
        layerViews.checkDrag.querySelector('input').onchange = function() {            
            function updateCheck(checkBox, layer:ILayer, layerViews) {        
                // on change
                layer.args.hideOnDrag = !layer.args.hideOnDrag
                onCheckChange()   
                ui.updateCounts()             
            }
            // on create?
            updateCheck(this, layer, layerViews)
        }
        pos += 5
    }

    var switchRow = null    
    ui.addSwitch = function()
    {
        const stateViews = {
            label: HTML.parse<HTMLElement>(labelHtml(pos))(),
            count: HTML.parse<HTMLElement>(countHtml(pos))(),
            view: HTML.parse<HTMLElement>(switchHtml(pos))(),            
            bar:  HTML.parse<HTMLElement>(barHtml(pos))(),
            updateCounts: () => {                
                stateViews.count.innerHTML = sum

                stateViews.bar.children[0].style.width = (sumtime/maxTimeLayerstack*100)+'%'
                stateViews.bar.children[0].style.backgroundColor = colores[0]
            }
        }
        switchRow = stateViews

        ui.appendChild(stateViews.label)
        ui.appendChild(stateViews.count)
        ui.appendChild(stateViews.view)        
        ui.appendChild(stateViews.bar)

        stateViews.label.innerHTML = "Σ"
        pos += 4
    }
       
    ui.updateSwitch = function(onOff) {        
        switchRow.view.style.marginLeft = onOff ? '1.95em' : '.08em'
    }
    ui.updateCounts = function(onOff) {
        sum = 0
        sumtime = 0 
        rows.forEach(e=> e.updateCounts(onOff))
        switchRow.updateCounts()
    }

    return ui
}
