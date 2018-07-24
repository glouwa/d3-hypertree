import { HTML }                from 'ducd'
import { HypertreeArgs }       from '../../models/hypertree/model'
import { N }                   from '../../models/n/n'
import { Path }                from '../../models/path/path'
import { CmulR }               from '../../models/transformation/hyperbolic-math'
import { IUnitDisk }           from '../unitdisk/unitdisk'
import { UnitDisk }            from '../unitdisk/unitdisk'
import { UnitDiskNav }         from '../unitdisk/unitdisk'
import { Hypertree }           from './hypertree'

import { HypertreeMeta }       from '../meta/hypertree-meta/hypertree-meta'
import { NoHypertreeMeta }     from '../meta/hypertree-meta/hypertree-meta'

const bubbleSvgDef =
    `<defs>
        <radialGradient id="exampleGradient">            
            <stop offset="58%"  stop-color="rgb(255,255,255)" stop-opacity=".08"/>            
            <stop offset="92%"  stop-color="rgb( 96, 96, 96)" stop-opacity=".08"/>
            <stop offset="98%"  stop-color="rgb( 36, 36, 36)" stop-opacity=".08"/>
            <stop offset="100%" stop-color="rgb(  0,  0,  0)" stop-opacity=".08"/>
        </radialGradient>
    </defs>` 

const btn = (name, icon, classes='', iconColor=undefined)=>
    `<button id="${name}" class="btn btn-small waves-effect waves-orange pn ${classes}">        
        <i class="material-icons" ${iconColor?'style="color:'+iconColor+';"':''}>${icon}</i>
    </button>`

const hypertreehtml =
    `<div class="unitdisk-nav">      

        <div id="meta"></div>        

        <div class="tool-bar">
            <div id="path" class="absolute-center">...</div>
            <!--
            ${btn('btnundo', 'undo')}
            ${btn('btncommit', 'check')}
            -->
            ${btn('btnnav', 'explore', 'tool-seperator')}
            ${btn('btnsize', 'all_out')}
            ${btn('btnmeta', 'layers')}            

            ${btn('btndownload', 'file_download', 'tool-seperator disabled')}
            ${btn('btnupload', 'cloud_upload', 'disabled')}            
            ${btn('btnhome', 'home', 'disabled')}
            ${btn('btnsearch', 'search')}
            
            <!--
            ,530, 470
            ${btn('btncut', 'content_cut')}
            ${btn('btncopy', 'content_copy')}
            ${btn('btnpaste', 'content_paste')}
            ${btn('btnbrowse', 'open_with', 'tool-seperator tool-active')}
            ${btn('btnadd', 'add')}
            ${btn('btnedit', 'border_color')}
            ${btn('btndelte', 'delete')}

            swap
            open
            search from here
            -->
        </div> 

        <div id="path-toolbar" class="tool-bar path-bar">            
            ${btn('btn-path-home', 'grade', 'tool-seperator'/*, '#ffee55'*/)}
            ${btn('btn-path-center', 'add_circle', /*, '#b5b5b5'*/)}
        </div> 
        
        <svg width="calc(100% - 3em)" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="-0 0 1000 1000">
            ${bubbleSvgDef}
        </svg>
        <div class="preloader"></div>
    </div>`

export class HypertreeEx extends Hypertree
{
    view_: {
        parent         : HTMLElement,
        path?          : HTMLElement,

        btnHome?       : HTMLElement,
        btnMeta?       : HTMLElement,
        btnNav?        : HTMLElement,
        btnSize?       : HTMLElement,

        pathesToolbar? : HTMLElement,
        btnPathHome?   : HTMLElement,

        html?          : HTMLElement,
        unitdisk?      : IUnitDisk,
        hypertreeMeta? : HypertreeMeta,        
    }
 
    noHypertreeMeta        
    hypertreeMeta  : HypertreeMeta
    
    constructor(view:{ parent:HTMLElement }, args:HypertreeArgs) {
        super(view, args)        
    }

    /*
    * this functions modyfy model/view (this class internal state)
    * and call the according update function(s)
    */
    public api = {
        setModel: (model: HypertreeArgs)=> {
            this.args = model        
            this.update.view.parent()
        },
        setLangloader: ll=> { 
            this.args.langloader = ll            
            this.args.langloader((langMap, t1, dl)=> {            
                this.langMap = langMap
                this.updateLang_(dl)
                this.update.langloader() 
            })
        },
        setDataloader: dl=> { 
            this.args.dataloader = dl
            const t0 = performance.now()
            this.resetData()
            this.args.dataloader((d3h, t1, dl)=> {
                this.initData(d3h, t0, t1, dl)                
                this.animateUp()
            })
        },
        toggleNav: ()=> {
            this.args.decorator = this.args.decorator === UnitDiskNav ? UnitDisk : UnitDiskNav
            this.update.view.unitdisk()
            this.update.data()
            this.hypertreeMeta.update.model()
            this.hypertreeMeta.update.layout()
            this.hypertreeMeta.update.transformation()
        },
        toggleMeta: ()=> {
            this.noHypertreeMeta = this.noHypertreeMeta ? undefined : new NoHypertreeMeta()
            this.update.view.meta()
            this.hypertreeMeta.update.model()
            this.hypertreeMeta.update.layout()
            this.hypertreeMeta.update.transformation()
        },
        toggleSelection: (n:N)=> {
            this.toggleSelection(n)
            this.update.pathes()
        },
        //addPath: (pathid, node:N)=> { this.addPath(pathid, node) },
        //removePath: (pathid, node:N)=> { this.removePath(pathid, node) },
        setPathHead: (pathType:Path, n:N)=> {
            this.setPathHead(pathType, n)
            this.update.pathes()
        },
        selectQuery: (query:string, prop:string)=> {
            const lq = query ? query.toLowerCase() : null
            this.data.each(n=> {
                n.pathes.partof = []
                n.pathes.headof = undefined
                n.pathes.labelcolor = undefined
                n.pathes.finalcolor = undefined                
                n.pathes.isPartOfAnyQuery = false                
            })            
            console.log('QUERY:', lq)
            this.args.objects.pathes = []
            this.data.each(n=> {                
                if (n.data) {
                    if (n.data.name.toLowerCase().includes(lq))
                        this.addPath('Query', n)
                    if (n.precalc && n.precalc.label)
                        if (n.precalc.label.toLowerCase().includes(lq))
                        this.addPath('Query', n)
                }
            })            
            this.update.pathes()
        },
        gotoHome: ()=>    this.animateTo({ re:0, im:0 }, null), 
        gotoNode: (n:N)=> this.animateTo(CmulR({ re:n.layout.z.re, im:n.layout.z.im }, -1), null),
    }

    /*
    * this functions assume the model/view (this class internal state)
    * has changes, and call the according ui updates (animatin frames)
    */
    public update = {        
        view: {
            parent:         ()=> this.updateParent(),
            unitdisk:       ()=> { this.updateUnitdiskView(); this.updateMetaView(); },
            meta:           ()=> this.updateMetaView(),
        },        
        data:           ()=> requestAnimationFrame(()=> {                            
                            this.unitdisk.update.data()
                            this.hypertreeMeta.update.transformation()
                            this.hypertreeMeta.update.layout()
                            this.hypertreeMeta.update.model()
                        }),        
        langloader:     ()=> requestAnimationFrame(()=> {                            
                            this.hypertreeMeta.update.lang()
                            this.update.data()
                        }),        
        layout:         ()=> requestAnimationFrame(()=> {
                            this.unitdisk.update.transformation() 
                            this.hypertreeMeta.update.layout()
                            this.hypertreeMeta.update.transformation()           
                        }),
        transformation: ()=> requestAnimationFrame(()=> {
                            this.unitdisk.update.transformation() 
                            this.hypertreeMeta.update.transformation()     
                        }),
        pathes:         ()=> requestAnimationFrame(()=> {
                            this.unitdisk.update.pathes()
                            this.hypertreeMeta.update.transformation()     
                        })
    }

    //########################################################################################################
    //##
    //## View Updates
    //##
    //########################################################################################################

    protected updateParent()
    {
        this.view_.parent.innerHTML = '' // actually just remove this.view if present ... do less
        this.view_.html = HTML.parse<HTMLElement>(hypertreehtml)()
        this.view_.parent.appendChild(this.view_.html)
        this.noHypertreeMeta   = new NoHypertreeMeta()
        this.view_.btnMeta     = <HTMLButtonElement>this.view_.html.querySelector('#btnmeta')
        this.view_.btnNav      = <HTMLButtonElement>this.view_.html.querySelector('#btnnav')
        this.view_.btnHome     = <HTMLButtonElement>this.view_.html.querySelector('#btnhome')
        this.view_.btnSize     = <HTMLButtonElement>this.view_.html.querySelector('#btnsize')

        this.view_.pathesToolbar = <HTMLButtonElement>this.view_.html.querySelector('#path-toolbar')        
        this.view_.btnPathHome   = <HTMLButtonElement>this.view_.html.querySelector('#btn-path-home')
                
        this.view_.btnHome.onclick     = ()=> this.api.gotoHome()
        this.view_.btnPathHome.onclick = ()=> this.api.gotoHome()
        this.view_.btnMeta.onclick     = ()=> this.api.toggleMeta()
        this.view_.btnNav.onclick      = ()=> this.api.toggleNav()        
        this.view_.btnSize.onclick     = ()=> {            
            const view = [
                'translate(500,520) scale(470)', // small
                'translate(500,520) scale(490)', // big
                'translate(500,520) scale(720, 490)', // oval 
                'translate(500,520) scale(720, 590)', // overlap
                'translate(500,620) scale(680, 800)', // mobile (vertical)
            ]
            const nav = [
                'translate(95,95) scale(70)',
                'translate(95,95) scale(70)',
                'translate(-150,105) scale(70)',
                'translate(-160,95) scale(70)',
                'translate(-150,105) scale(70)'
            ]
            sizeidx = ++sizeidx % 5
            this.unitdisk.api.setTransform(view[sizeidx], nav[sizeidx])
        }
        let sizeidx = 0

        this.view_.path = <HTMLElement>this.view_.html.querySelector('#path')

        this.updateUnitdiskView()
        this.updateMetaView()    

        this.api.setDataloader(this.args.dataloader)        
        this.api.setLangloader(this.args.langloader)
    }

    private updateMetaView()
    {
        var metaparent = this.view_.html.querySelector('.unitdisk-nav > #meta')
        metaparent.innerHTML = ''
        this.hypertreeMeta = this.noHypertreeMeta || new this.unitdisk.HypertreeMetaType({ 
                view: { parent:metaparent },
                model: this
            })
    }

    //########################################################################################################
    //##
    //## Sync blocks for async api functions
    //##
    //########################################################################################################

    protected resetData() {        
        super.resetData()

        this.view_.path.innerText = ''
        this.view_.pathesToolbar.innerHTML = 
            btn('btn-path-home', 'grade', 'tool-seperator', '#e2d773') //'#ffee55'
          + btn('btn-path-center', 'add_circle', 'disabled'/*, '#b5b5b5'*/)
        this.view_.pathesToolbar
            .querySelector<HTMLButtonElement>('#btn-path-home')
            .onclick = ()=> this.api.gotoHome()
    }

    //########################################################################################################
    //##
    //## Path
    //##
    //########################################################################################################
           
    protected addPath(pathType:string, n:N) {
        const newpath = super.addPath(pathType, n)    
        
        if (pathType === 'Query')
            return

        // view: btn   ==> update.btntoolbar()    
        const btnElem = HTML.parse(btn(
            newpath.id, 
            newpath.icon, 
            pathType === 'HoverPath' ? 'disabled' : '', 
            newpath.color))()        
        btnElem.onclick = ()=> this.api.gotoNode(n)
        btnElem.title = `${n.precalc.txt}`
        this.view_.pathesToolbar.insertBefore(btnElem, pathType==='HoverPath' ? null : this.view_.pathesToolbar.firstChild)        
        return newpath
    }

    protected removePath(pathType:string, n:N) {
        super.removePath(pathType, n)
        
        const pathId = this.btnPathId(pathType, n)
        const btnElem = this.view_.pathesToolbar.querySelector(`#${pathId}`)
        this.view_.pathesToolbar.removeChild(btnElem)
    }
}

