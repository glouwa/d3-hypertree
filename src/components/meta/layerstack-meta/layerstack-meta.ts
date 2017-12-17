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

export function LayerInfo(parent, unitdisk, cls)
{
    var ui = HTML.parse<HTMLElement & { updateInfo }>(html)()
    ui.classList.add(cls)
    parent.appendChild(ui)
    
    var rows = ['name', 'type', 'count', 'time', 'enabled']
    var cols = 'layers'

    var  pos = 0
    function add(layer) {

        var name = layer.name        
        var checked = !layer.args.invisible
        var checked2 = !layer.args.invisibleOnDrag

        const layerViews = {
            label:       HTML.parse<HTMLElement>(labelHtml(pos, checked))(),
            count:       HTML.parse<HTMLElement>(countHtml(pos, checked))(),
            checkNormal: HTML.parse<HTMLElement>(check1Html(`pos-${cls}-${pos}-normal`, checked))(),
            checkDrag:   HTML.parse<HTMLElement>(check1Html(`pos-${cls}-${pos}-drag`, checked2))(),
            bar:         HTML.parse<HTMLElement>(barHtml(pos, checked))(),
        }

        ui.appendChild(layerViews.label)
        ui.appendChild(layerViews.count)
        ui.appendChild(layerViews.checkNormal)
        ui.appendChild(layerViews.checkDrag)
        ui.appendChild(layerViews.bar)
        
        ui.children[pos].innerHTML = name
        layerViews.checkNormal.querySelector('input').onchange = function() {            
            function updateCheck(checkBox, layer:ILayer, layerViews) {        
                layer.args.invisible = !layer.args.invisible

                var checked = !layer.args.invisible
                var type = 'circle'
                var count = layer.args.data?layer.args.data.length:1

                layerViews.count.innerHTML = checked?`${count} ${type}`:``
                unitdisk.layerStack.updateLayers()
            }
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

    for (var l in unitdisk.layerStack.layers)            
        add(unitdisk.layerStack.layers[l])
    
    return ui
}
