import { Tree } from "./n-tree"
import { N } from './n'
import { stratify } from 'd3-hierarchy'
import { json, csv } from 'd3-request'

// todo loader MUSS ein generic sein
export type LoaderFunction = (ok: (root:N)=>void)=> void

function oneNode(ok) {
    ok({
        parent:null,
        children:[],
        data:{}
    })
}

function path(ok, max) {
    oneNode(d=> {
        var cur = d
        for (var i=0; i < max; i++) {
            var newN = { parent:d, children:[] }
            cur.children.push(newN)
            cur = newN
        }
        ok(d)
    })
}

function star(ok, max) {
    oneNode(d=> {
        for (var i=0; i < max-1; i++)
            d.children.push({ parent:d, children:[] })
        ok(d)
    })
}
function loadFromLangFile(ok, file) {
    json(file, (error, langData) =>
        ok(langData))
}

function loadFromFile(ok, file) {
    if (file.endsWith('.xml') ||
        file.endsWith('.json') ||
        file.endsWith('.rdf'))
        if (file.endsWith('.d3.json') || file == "data/upload/user-uploaded.xml")
            json(file, (error, treeData) =>
                ok(treeData))
        else
            new Tree(ok, file)
    else
        csv(file, function(error, data) {
            if (error)
                throw error;
            ok(stratify().parentId((d:N)=> d.id.substring(0, d.id.lastIndexOf(".")))(data))
        })
}

export var path_ =        n=> ok=> path(ok, n)
export var star_ =        n=> ok=> star(ok, n)
export var fromFile =     f=> ok=> loadFromFile(ok, f)
export var fromLangFile = f=> ok=> loadFromLangFile(ok, f)

export function nTreeAtFirst(ok, max=10) {
    oneNode(d=> {
        var cur = d
        for (var i=0; i < max; i++) {
            for (var j=0; j<10; j++) {
                var newN = { parent:d, children:[] }
                cur.children.push(newN)
            }
            cur = newN
        }
        ok(d)
    })
}

export function nTree(ok, depth=10, childs=2) {
    oneNode(d=> {
        function processNode(parent, l)
        {
            if (l>=depth) return
            for (var i=0; i<childs; i++) {
                var newN = { parent:parent, children:[] }
                parent.children.push(newN)
                processNode(newN, l+1)
            }
        }
        processNode(d, 0)
        ok(d)
    })
}

export function deepStar(ok, arms=4, depth=30) {
    oneNode(d=> {
        for (var i=0; i < arms; i++) {
            var l1 = { parent:d, children:[] }
            d.children.push(l1)
            var cur = l1
            for (var j=0; j < depth; j++) {
                var newN = { parent:d, children:[] }
                cur.children.push(newN)
                cur = newN
            }
        }
        ok(d)
    })
}

/**
 * spaecial tactics loader for navDisks
 * generates a path containing nodes for each member of 'o'
 *
 * no new object created, o is extended by tree stuff.
 */
export function obj2data(o)
{
    var cur = null
    var root = null
    for (var name in o) {
        var newN = o[name]
        newN.name = name
        //newN.parent = cur
        newN.children = []

        if (cur)
            cur.children.push(newN)
        else
            root = newN
        cur = newN
    }
    return root
}

/**
 * creates node object for each namespace, and type
 */
function type2data(o, name)
{
    var root = { name:name, children:[] }
    for (var n in o)
        root.children.push(type2data(o[n], n))

    return root
}

export function code(ok)
{
    ok(type2data({ a:{ b:{}, c:{} }}/*ivis*/, 'ivis'))
}

export namespace generators
{
//    export var star5 = star_(5)
//    export var star51 = star_(50)
    export var star120 = deepStar
    export var star501 = star_(500)
//    export var path50 = path_(50)
//    export var path500 = path_(500)
//    export var path5000 = path_(5000)
    export var nT1 = nTree
    export var nT2 = nTreeAtFirst
}
