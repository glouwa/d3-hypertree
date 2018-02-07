import * as d3              from 'd3'
import { HTML }             from 'ducd'
import { stringhash }       from 'ducd'
import { googlePalette }    from 'ducd'
import { ILayer }           from '../../layerstack/layer'
import { IUnitDisk }        from '../../unitdisk/unitdisk'

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
            onCheckChange: ()=> this.model.layerStack.update.transformation()
        })

        Object.keys(this.model.layerStack.layers).reverse().forEach(e=> 
            this.ui.addlayer(this.model.layerStack.layers[e])    
        )

        this.ui.addSwitch()
    }
}
    
var ping1Html  = (id)=>     `<div class="ping1"></div> `
var ping2Html  = (id)=>     `<div class="ping2"></div> `
var labelHtml  = (id)=>     `<div class="label"></div> `
var countHtml  = (id)=>     `<div class="nodes"></div> `
var timeHtml   = (id)=>     `<div class="time"></div> `
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
    addlayer
}

function ping(v, cond=true) {                
    if (cond) {
        v.style.opacity = 1
        v.style.animation = ""        
        requestAnimationFrame(()=> {             
            //v.style.animation = "blink-out 750ms cubic-bezier(0.070, 0.065, 0.765, -0.135)"
            //v.style.animation = "blink-out 2ms cubic-bezier(0.070, 0.455, 0.850, 0.420)"
            v.style.animation = "blink-out 2s cubic-bezier(0.145, 1.130, 0.725, 0.590)"            
            v.style.opacity = 0
        })
    }
}

export function LayerInfo_({ parent, onCheckChange, className })
{
    var ui = HTML.parse<LayerStackMetaUi>(html)()
    ui.classList.add(className)
    parent.appendChild(ui)
    
    var rows = []
    var cols = ['name', 'type', 'count', 'time', 'enabled']
     
    const maxElementCount = 300        
    const maxElementCountGlobal = 1000        
    const maxTimeLayer = 10
    const maxTimeLayerstack = 20

    const d3format_ = d3.format('.2s')
    const isIrrelevant = (n)=> (isNaN(n) || (n*1000).toFixed(0) === '0')
    const d3format = (n)=> 
                   isIrrelevant(n)
                   ? '•' //•·
                   : (n*1000).toFixed(0) + '<sub>ms</sub>'
    var sum = 0
    var sumtime = 0
    
    var pos = 0
    var cc = 0
    ui.addlayer = function(layer) {

        var name = layer.name        
        var color = googlePalette(stringhash(name))
        
        var checked =  ()=> !layer.args.invisible
        var checked2 = ()=> !layer.args.hideOnDrag
        var count =    ()=> (layer.d3updatePattern && layer.d3updatePattern.data ? layer.d3updatePattern.data.length : 1)        
        var type =     ()=> (layer.args.elementType?layer.args.elementType.length:'')

        const layerViews = {
            ping2:       HTML.parse<HTMLElement>(ping2Html(pos))(),
            ping1:       HTML.parse<HTMLElement>(ping1Html(pos))(),
            label:       HTML.parse<HTMLElement>(labelHtml(pos))(),
            count:       HTML.parse<HTMLElement>(countHtml(pos))(),
            time:        HTML.parse<HTMLElement>(timeHtml(pos))(),
            checkNormal: HTML.parse<HTMLElement>(check1Html(`pos-${className}-${pos}-normal`, checked()))(),
            checkDrag:   HTML.parse<HTMLElement>(check1Html(`pos-${className}-${pos}-drag`, checked2()))(),
            bar:         HTML.parse<HTMLElement>(barHtml(pos))(),
            updateCounts: (animationRunning) => {     
                var checker = animationRunning ? checked2() : checked()                
                var count_ = checker ? count() : 0
                sum += count_
                
                layerViews.count.innerHTML = checker?`${count_} ${type()}`:``
        
                const lsmeta = layer.view.layerstack.d3meta
                console.assert(layer.name)                
                const pos = lsmeta.names.indexOf(layer.name)
                const time = checker ? lsmeta.Δ[pos]/1000 : 0
                
                if (!isNaN(time))
                    sumtime += time

                const timeStr = d3format(time) 
                layerViews.time.innerHTML = checker ? timeStr : ``

                layerViews.bar.children[0].style.width = (time/maxTimeLayer*100*1000)+'%'
                layerViews.bar.children[0].style.backgroundColor = color
                ping(layerViews.ping1, checker && !isIrrelevant(time))
                ping(layerViews.ping2, checker && !isIrrelevant(time) && time*1000 > maxTimeLayer)
            }
        }
        rows.push(layerViews)

        ui.appendChild(layerViews.ping2)
        ui.appendChild(layerViews.ping1)
        ui.appendChild(layerViews.label)
        ui.appendChild(layerViews.count)
        ui.appendChild(layerViews.time)
        ui.appendChild(layerViews.checkNormal)
        ui.appendChild(layerViews.checkDrag)
        ui.appendChild(layerViews.bar)
        
        if (name === 'λ') layerViews.label.style.textTransform = 'none'
        layerViews.label.innerHTML = name
        
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
        pos += 8
    }

    var switchRow = null    
    ui.addSwitch = function()
    {
        const stateViews = {
            ping2: HTML.parse<HTMLElement>(ping2Html(pos))(),
            ping1: HTML.parse<HTMLElement>(ping1Html(pos))(),
            label: HTML.parse<HTMLElement>(labelHtml(pos))(),
            count: HTML.parse<HTMLElement>(countHtml(pos))(),
            time:  HTML.parse<HTMLElement>(timeHtml(pos))(),
            view:  HTML.parse<HTMLElement>(switchHtml(pos))(),            
            bar:   HTML.parse<HTMLElement>(barHtml(pos))(),
            updateCounts: () => {                
                stateViews.count.innerHTML = sum

                const timeStr = d3format(sumtime) 
                stateViews.time.innerHTML = timeStr

                stateViews.bar.children[0].style.width = (sumtime/maxTimeLayerstack*100*1000)+'%'
                stateViews.bar.children[0].style.backgroundColor = googlePalette(0)
            }
        }
        switchRow = stateViews

        ui.appendChild(stateViews.ping2)
        ui.appendChild(stateViews.ping1)
        ui.appendChild(stateViews.label)
        ui.appendChild(stateViews.count)
        ui.appendChild(stateViews.time)
        ui.appendChild(stateViews.view)        
        ui.appendChild(stateViews.bar)

        stateViews.label.innerHTML = "Σ"
        pos += 7
    }
       
    ui.updateSwitch = function(onOff) {        
        switchRow.view.style.marginLeft = onOff ? '2.12em' : '.25em'
    }
    ui.updateCounts = function(onOff) {
        sum = 0
        sumtime = 0 
        rows.forEach(e=> e.updateCounts(onOff))
        ping(switchRow.ping1)
        ping(switchRow.ping2, sum>maxElementCountGlobal) // or sumtime > ~25?
        switchRow.updateCounts()
        
    }

    return ui
}
