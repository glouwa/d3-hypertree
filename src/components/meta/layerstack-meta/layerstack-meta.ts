import { HTML } from 'ducd'
import { ILayer } from '../../layerstack/layer'

var labelHtml  = (id, c)=>  `<div class="label"></div> `
var countHtml  = (id, c)=>  `<div class="nodes"></div> `
var switchHtml = (id, c)=>  `<div class="switch"></div> `
var check1Html = (id, c)=>  `<div class="cbx">           
                                <input type="checkbox" id="${id}" class="filled-in" ${c?'checked':''}/>
                                <label for="${id}"></label>
                             </div>`
var barHtml    = (id, c)=>  `<div class="bar-bg"></div>`
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
        this.ui = LayerInfo_(view.parent, model, view.className)
    }

    update = {
        all: ()=> { 
            //this.update.existance(); 
            this.update.state(); 
            this.update.counts(); 
        },
        existance: ()=> this.updateExistence(),
        state: ()=> this.updateState(),
        counts: ()=> this.updateCounts()        
    }

    private updateExistence()
    {
        console.log('update existence')   
    }

    private updateState()
    {
        //console.log('update state')
        this.ui.updateSwitch()
    }

    private updateCounts()
    {
        //console.log('update counts')   
        this.ui.updateCounts()
    }
}

export function LayerInfo_(parent, unitdisk, cls)
{
    var ui = HTML.parse<HTMLElement & { updateInfo }>(html)()
    ui.classList.add(cls)
    parent.appendChild(ui)
    
    var rows = []
    var cols = ['name', 'type', 'count', 'time', 'enabled']

    var  pos = 0
    function addCheckboxes(layer) {

        var name = layer.name        
        
        var checked = ()=> !layer.args.invisible
        var checked2 = ()=> !layer.args.hideOnDrag
        var count = ()=> (layer.args.data?layer.args.data().length:1)
        var type = ()=> (layer.args.elementType?layer.args.elementType.length:'')

        const layerViews = {
            label:       HTML.parse<HTMLElement>(labelHtml(pos, checked()))(),
            count:       HTML.parse<HTMLElement>(countHtml(pos, checked()))(),
            checkNormal: HTML.parse<HTMLElement>(check1Html(`pos-${cls}-${pos}-normal`, checked()))(),
            checkDrag:   HTML.parse<HTMLElement>(check1Html(`pos-${cls}-${pos}-drag`, checked2()))(),
            bar:         HTML.parse<HTMLElement>(barHtml(pos, checked()))(),
            updateCounts: () => {                
                layerViews.count.innerHTML = checked()?`${count()} ${type()}`:``
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
                
                layerViews.count.innerHTML = checked()?`${count()} ${type()}`:``
                
                unitdisk.layerStack.updateLayers()
            }

            // on create?
            updateCheck(this, layer, layerViews)
        }

        pos += 5
    }

    function addSwitch()
    {
        const stateViews = {
            view: HTML.parse<HTMLElement>(switchHtml(pos, true))(),
            drag: HTML.parse<HTMLElement>(switchHtml(pos, true))(),
            bar:  HTML.parse<HTMLElement>(barHtml(pos, false))(),
        }

        ui.appendChild(document.createElement('div'))
        ui.appendChild(document.createElement('div'))
        ui.appendChild(stateViews.view)
        ui.appendChild(stateViews.drag)        
        ui.appendChild(stateViews.bar)

        stateViews.drag.style.visibility = 'hidden'

        pos += 5
    }

    if (cls !== 'nav')
        addSwitch()

    //add(unitdisk.layerStack.layers[l])

    for (var l in unitdisk.layerStack.layers)            
        addCheckboxes(unitdisk.layerStack.layers[l])

    ui.updateSwitch = function(){

    }
    ui.updateCounts = function(){
        rows.forEach(e=> e.updateCounts())
    }

    return ui
}
