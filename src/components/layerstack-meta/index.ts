import { HTML } from 'ducd'

var cbox1 = (id, c)=>  `<div class="label"></div> `
var cbox2 = (id, c)=>  `<div class="nodes"></div> `
var cbox3 = (id, c)=>  `<div class="cbx">           
                            <input type="checkbox" id="${id}" class="filled-in" ${c?'checked':''}/>
                            <label for="${id}"></label>
                        </div> `
var cbox4 = (id, c)=>  `<div class="bar-bg"></div>`

var html = `<div class="layer-info"> </div>`

export function LayerInfo(parent, unitdisk, cls)
{
    var ui = HTML.parse<HTMLElement & { updateInfo }>(html)()
    ui.classList.add(cls)
    parent.appendChild(ui)
    
    var rows = ['name', 'type', 'count', 'time', 'enabled']
    var cols = 'layers'

    var  pos = 0
    function add(name, type, count, checked?, checked2?) {    
        
        ui.appendChild(HTML.parse<HTMLElement>(cbox1(pos, checked))())
        ui.appendChild(HTML.parse<HTMLElement>(cbox2(pos, checked))())
        ui.appendChild(HTML.parse<HTMLElement>(cbox3(`pos-${cls}-${pos}-normal`, checked))())
        ui.appendChild(HTML.parse<HTMLElement>(cbox3(`pos-${cls}-${pos}-drag`, checked2))())
        ui.appendChild(HTML.parse<HTMLElement>(cbox4(pos, checked))())

        ui.children[pos]  .innerHTML = name
        if (checked)
            ui.children[pos+1].innerHTML = `${count} ${type}`
        pos += 5
    }

    for (var l in unitdisk.layerStack.layers)
    {
        var layer = unitdisk.layerStack.layers[l]        
        add(layer.name, 'circle', layer.args.data?layer.args.data.length:1, true, true)
        console.log(layer)
    }
    
    return ui
}
