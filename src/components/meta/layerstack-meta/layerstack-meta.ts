import { HTML } from 'ducd'
import { ILayer } from '../../layerstack/layer'

var labelHtml  = (id)=>     `<div class="label"></div> `
var countHtml  = (id)=>     `<div class="nodes"></div> `
var switchHtml = (id)=>     `<div class="switch"></div> `
var check1Html = (id, c)=>  `<div class="cbx">           
                                <input type="checkbox" id="${id}" class="filled-in" ${c?'checked':''}/>
                                <label for="${id}"></label>
                             </div>`
var barHtml    = (id)=>     `<div class="bar-bg"></div>`
var html       =            `<div class="layer-info"></div>`

export class LayerInfo
{
    view
    model
    ui : HTMLElement

    constructor({ view, model })
    {
        this.view = view
        this.model = model
        this.ui = LayerInfo_({
            parent: view.parent,            
            className: view.className,
            onCheckChange: ()=> { this.model.layerStack.updateLayers()
        })

        this.ui.addSwitch()
        for (var l in this.model.layerStack.layers)            
            this.ui.addCheckboxes(this.model.layerStack.layers[l])    
    }

    update = {
        all: ()=> { 
            //this.update.existance(); 
            this.update.state(); 
            this.update.counts(); 
        },
        existance: ()=> this.updateExistence(),
        state:     ()=> this.updateState(),
        counts:    ()=> this.updateCounts()        
    }

    private updateExistence()
    {
        console.log('update existence')   
    }

    private updateState()
    {
        //console.log('update state')
        this.ui.updateSwitch(this.model.args.transformation.dST)
    }

    private updateCounts()
    {
        //console.log('update counts')   
        this.ui.updateCounts()
    }
}

export function LayerInfo_({ parent, onCheckChange, className })
{
    var ui = HTML.parse<HTMLElement & { updateInfo }>(html)()
    ui.classList.add(className)
    parent.appendChild(ui)
    
    var rows = []
    var cols = ['name', 'type', 'count', 'time', 'enabled']

    var  pos = 0
    ui.addCheckboxes = function(layer) {

        var name = layer.name        
        var checked = ()=> !layer.args.invisible
        var checked2 = ()=> !layer.args.hideOnDrag
        var count = ()=> (layer.args.data?layer.args.data().length:1)
        var type = ()=> (layer.args.elementType?layer.args.elementType.length:'')

        const layerViews = {
            label:       HTML.parse<HTMLElement>(labelHtml(pos))(),
            count:       HTML.parse<HTMLElement>(countHtml(pos))(),
            checkNormal: HTML.parse<HTMLElement>(check1Html(`pos-${className}-${pos}-normal`, checked()))(),
            checkDrag:   HTML.parse<HTMLElement>(check1Html(`pos-${className}-${pos}-drag`, checked2()))(),
            bar:         HTML.parse<HTMLElement>(barHtml(pos))(),
            updateCounts: () => {     
                var count_ = checked()?count():0
                sum += count_
                layerViews.count.innerHTML = checked()?`${count_} ${type()}`:``           
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

        pos += 5
    }

    var switchRow = null
    var sum = 0
    ui.addSwitch = function()
    {
        const stateViews = {
            label: HTML.parse<HTMLElement>(labelHtml(pos))(),
            count: HTML.parse<HTMLElement>(countHtml(pos))(),
            view: HTML.parse<HTMLElement>(switchHtml(pos))(),            
            bar:  HTML.parse<HTMLElement>(barHtml(pos))(),
            updateCounts: () => {                
                stateViews.count.innerHTML = sum
            }
        }
        switchRow = stateViews

        ui.appendChild(stateViews.label)
        ui.appendChild(stateViews.count)
        ui.appendChild(stateViews.view)        
        ui.appendChild(stateViews.bar)

        stateViews.label.innerHTML = "Σ" //∑
        //stateViews.count.innerHTML = "323"

        pos += 4
    }
       
    ui.updateSwitch = function(onOff) {
        //switchRow.view.style.visibility =  onOff ? 'hidden':'visible'
        //switchRow.drag.style.visibility = !onOff ? 'hidden':'visible'
        switchRow.view.style.marginLeft = onOff ? '1.95em' : '.08em'
    }
    ui.updateCounts = function() {
        sum = 0
        rows.forEach(e=> e.updateCounts())
        switchRow.updateCounts()
    }

    return ui
}
