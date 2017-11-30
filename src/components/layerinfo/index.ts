import { HTML } from 'ducd'

var cbox1 = (id, c)=>  `<div class="label"></div> `
var cbox2 = (id, c)=>  `<div class="nodes"></div> `
var cbox3 = (id, c)=>  `<div class="cbx">           
                            <input type="checkbox" id="${id}" class="filled-in" ${c?'checked':''}/>
                            <label for="${id}"></label>
                        </div> `
var cbox4 = (id, c)=>  `<div class="bar-bg"></div>`

var html = `<div class="layer-info"> </div>`

export function LayerInfo(args)
{
    var ui = HTML.parse<HTMLElement & { updateInfo }>(html)()
    args.parent.appendChild(ui)
    
    var rows = ['name', 'type', 'count', 'time', 'enabled']
    var cols = 'layers'

    var  pos = 0
    function add(name, type, count, checked?) {     
        
        ui.appendChild(HTML.parse<HTMLElement>(cbox1(pos, checked))())
        ui.appendChild(HTML.parse<HTMLElement>(cbox2(pos, checked))())
        ui.appendChild(HTML.parse<HTMLElement>(cbox3(pos, checked))())
        ui.appendChild(HTML.parse<HTMLElement>(cbox4(pos, checked))())

        ui.children[pos]  .innerHTML = name
        if (checked)
            ui.children[pos+1].innerHTML = `${count} ${type}`
        pos += 4
    }

    add('Bg',      'circles',   6, true)
    add('IFλ',     'circles',   6, true)
    add('Cells',   'polygons',  6, true)
    add('Weight',  'circles',   0)
    add('Pathes',  'lines',     0)
    add('Pathes2', 'arcs',      0)
    add('Arcs',    'paths',     0)
    add('Lines',   'lines',    36, true)
    add('Leafs',   'circles',   6, true)
    add('Lazys',   'circles',  26, true)
    add('Nodes',   'circles',   0)
    add('LabelBg', 'rects',     0)
    add('Label',   'texts',    16, true)
    add('Symbols', 'paths',     6, true)

    return ui
}
