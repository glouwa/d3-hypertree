/*
 * n-tree gets a path to an input file and computes the tree from this data
 *
 */


import { parseString } from 'xml2js'


  declare type WeightFunction = (node: TreeNode) => void;

  //===================================================
  class MissingFieldError extends Error {
    fieldname: string;

    constructor(field: string) {
      super(field);
      this.fieldname = field;
    }
  }

  class InvalidFileError extends Error {
    constructor() {
      super();
    }
  }

  class RDFHelper {
    static getIdFromScheme(scheme: Object): string {
      let schemeProperties: string[] = Object.keys(scheme);
      for (let i = 0; i < schemeProperties.length; i++) {
        if (schemeProperties[i].indexOf(':identifier') !== -1) {
          let identifier = scheme[schemeProperties[i]];
          if (identifier.hasOwnProperty('0'))
            identifier = identifier[0];
          return identifier;
        }
      }

      return null;
    }

    static getNameFromScheme(scheme: Object): string {
      let schemeProperties: string[] = Object.keys(scheme);
      for (let i = 0; i < schemeProperties.length; i++) {
        if (schemeProperties[i].indexOf(':title') !== -1) {
          let identifier = scheme[schemeProperties[i]];
          if (identifier.hasOwnProperty('0'))
            identifier = identifier[0];
          if (identifier.hasOwnProperty('_'))
            identifier = identifier['_'];
          return identifier;
        }
      }

      return null;
    }

    static getIdFromConcept(concept: Object): string {
      let id = null;
      if (concept.hasOwnProperty('$'))
        concept = concept['$'];
      if (concept.hasOwnProperty('rdf:about'))
        id = concept['rdf:about'];

      return id;
    }

    static getNameFromConcept(concept: Object): string {
      //check for prefLabel
      if (concept.hasOwnProperty('skos:prefLabel')) {
        concept = concept['skos:prefLabel'];
        if (concept.hasOwnProperty('0'))
          concept = concept['0'];
        if (concept.hasOwnProperty('_'))
          concept = concept['_'];
        return String(concept);
      }

      let conceptProperties: string[] = Object.keys(concept);
      for (let i = 0; i < conceptProperties.length; i++) {
        let currProperty = conceptProperties[i];
        if (currProperty.indexOf(':title') !== -1 ||
            currProperty.indexOf('Label') ||
            currProperty.indexOf('Name') !== -1) {
          let name = concept[currProperty];
          if (name.hasOwnProperty('0'))
            name = name[0];
          if (name.hasOwnProperty('_'))
            name = name['_'];
          return name;
        }
      }

      return null;
    }
  }
  //===================================================
  class InputFile {
    static json : string = 'JSON';
    static treeML : string = 'TREEML';
    static skos : string = 'SKOS';

    static determineFileType(data: string) : string {
      try {
        JSON.parse(data);
        return this.json;
      } catch (e) {
        if (data.indexOf("skos") != -1) {
          return this.skos;
        }
        return this.treeML;
      }
    }
  }

  //===================================================
  class InputJSON {
    static jsonToTree(data : string) : TreeNode[] {
      let parsedJson = JSON.parse(data);
      try {
        return this.createNodes(parsedJson);;
      } catch (e) {
        console.log("Invalid data file.");
        console.log(e);
      }
    }

    static createNodes(json: Object[]) : TreeNode[] {
      let tree : TreeNode[] = [];
      json.forEach((obj: TreeNode) => {
        let node : TreeNode = new TreeNode().deserialize(obj);
        tree.push(node);
      });
      return tree;
    }
  }

  //===================================================
  class InputTreeML{
    static treemlToTree(data: string, callback, originalTreeObject: Tree) {
      parseString(data, (err, result) => {
        if (err != null) {
          console.log("Invalid data file");
          return null;
        }

        try {
          let rootNode = result;
          if (rootNode.hasOwnProperty('tree'))
            rootNode = rootNode['tree'];
          if (rootNode.hasOwnProperty('branch'))
            rootNode = rootNode['branch'];
          if (rootNode.hasOwnProperty('0'))
            rootNode = rootNode['0'];
          let json: Object[] = [];
          json.push(this.toJSON(rootNode));
          let tree: TreeNode = InputJSON.createNodes(json)[0];
          originalTreeObject.setTree(tree);
          callback(tree);
        } catch (e) {
          console.log(e);
          console.log(e.stack);
        }
      })
    }

    private static toJSON(inputNode: Object) : Object {
      let resultNode = {
        id: '',
        name: '',
        children: null
      };

      //id, name
      if (inputNode.hasOwnProperty('attribute')) {
        let attributes = inputNode['attribute'];
        for (let i = 0; i < attributes.length; i++) {
          let attribute = attributes[i];
          if (attribute.hasOwnProperty('$')) {
            attribute = attribute['$'];
            if (attribute.hasOwnProperty('name') && attribute.hasOwnProperty('value')) {
              if (attribute['name'] == 'id') {
                resultNode.id = attribute['value'];
              } else if (attribute['name'] == 'name') {
                resultNode.name = attribute['value'];
              }
            }
          }
        }
      }

      if (resultNode.id == '')
        resultNode.id = resultNode.name;

      //children
      if (inputNode.hasOwnProperty('branch')) {
        if (resultNode.children == null)
          resultNode.children = [];
        let branches = inputNode['branch'];
        for (let i = 0; i < branches.length; i++) {
          resultNode.children.push(this.toJSON(branches[i]));
        }
      }
      if (inputNode.hasOwnProperty('leaf')) {
        if (resultNode.children == null)
          resultNode.children = [];
        let leaves = inputNode['leaf'];
        for (let i = 0; i < leaves.length; i++) {
          resultNode.children.push(this.toJSON(leaves[i]));
        }
      }

      return resultNode;
    }
  }

  //===================================================
  class InputSkos {
    static skosToTree(data: string, callback, originalTreeObject: Tree) {
      parseString(data, (err, result) => {
        if (err != null) {
          console.log("Invalid data file", err);
          return null;
        }
        try {
          let rdf = result;
          if (rdf.hasOwnProperty('rdf:RDF'))
            rdf = rdf['rdf:RDF'];
          let rootNode = new TreeNode();
          if (rdf.hasOwnProperty('skos:ConceptScheme')) {
            let conceptScheme = rdf['skos:ConceptScheme'][0];
            rootNode.id = RDFHelper.getIdFromScheme(conceptScheme);
            rootNode.name = RDFHelper.getNameFromScheme(conceptScheme);
            if (rootNode.id == null)
              rootNode.id = rootNode.name;

            if (conceptScheme.hasOwnProperty('skos:hasTopConcept'))
              rootNode.children = this.addChildIds(conceptScheme['skos:hasTopConcept']);
            if (rdf.hasOwnProperty('skos:Concept'))
              rdf = rdf['skos:Concept'];
            rootNode = this.addOtherNodes(rootNode, rdf);
          } else if (rdf.hasOwnProperty('rdf:Description')) {
            rootNode.id = null;
            rdf = rdf['rdf:Description'];
            let nodeMap: { [id: string]: TreeNode } = this.createAllNodes(rdf);
            rootNode = this.connectNodesFromMap(nodeMap);
            if (rootNode == null)
              throw new InvalidFileError();
          }

          originalTreeObject.setTree(rootNode);
          callback(rootNode);
        } catch (e) {
          console.log(e);
          console.log(e.stack);
        }

      })
    }

    private static addChildIds(conceptList: Object[]) : TreeNode[] {
      let resultArray : TreeNode[] = [];
      for (let i = 0; i < conceptList.length; i++) {
        let node = new TreeNode();
        node.id = conceptList[i]['$']['rdf:resource'];
        if (resultArray.indexOf(node) == -1)
          resultArray.push(node);
      }
      return resultArray;
    }

    private static addOtherNodes(root: TreeNode, conceptList: Object[]) {
      let inTreeNotUsedNodes: TreeNode[] = [];
      let nodesWithUndefinedParents:  TreeNode[] = [];
      for (let i = 0; i < conceptList.length; i++) {
        let currentConcept = conceptList[i];
        let node: TreeNode = this.conceptToNode(currentConcept);

        if (root.id == null) {
          root = node;
        }
        //is child of some other node
        if (currentConcept.hasOwnProperty('skos:inScheme')) {
          node.parent = this.addParentId(currentConcept['skos:inScheme'][0]['$']['rdf:resource']);
          if (root.addChildToScheme(node, node.parent.id) == false)
            nodesWithUndefinedParents.push(node);
        }

        if ((root.setChild(node) == false) && (root != node))
          inTreeNotUsedNodes.push(node);

        for (let j = 0; j < inTreeNotUsedNodes.length; j++) {
          inTreeNotUsedNodes[j].parent = node;
          if (node.setChild(inTreeNotUsedNodes[j]) == true)
            inTreeNotUsedNodes.splice(j, 1);
        }

        for (let k = 0; k < nodesWithUndefinedParents.length; k++) {
          if (root.addChildToScheme(nodesWithUndefinedParents[k], nodesWithUndefinedParents[k].parent.id) == true)
            nodesWithUndefinedParents.splice(k, 1);
        }
      }

      return root;
    }

    private static createAllNodes(conceptList: Object[]) {
      let resultMap: {[id: string]: TreeNode} = {};
      for (let i = 0; i < conceptList.length; i++) {
        let currentConcept = conceptList[i];
        let node: TreeNode = this.conceptToNode(currentConcept)
        //is child of some other node
        if (currentConcept.hasOwnProperty('skos:inScheme'))
          node.parent = this.addParentId(currentConcept['skos:inScheme'][0]['$']['rdf:resource']);

        resultMap[node.id] = node;
      }

      return resultMap;
    }

    private static conceptToNode(concept: Object): TreeNode {
      let node = new TreeNode();
      node.id = RDFHelper.getIdFromConcept(concept);
      node.name = RDFHelper.getNameFromConcept(concept);

      //has children
      if (concept.hasOwnProperty('skos:narrower'))
        node.children = this.addChildIds(concept['skos:narrower']);

      return node;
    }

    private static connectNodesFromMap(map: {[key: string]: TreeNode}): TreeNode {
      for (let nodeId in map) {
        //set parent
        let currNode = map[nodeId];
        if (currNode.parent != null) {
          let parentNode = map[currNode.parent.id];
          if (parentNode == undefined) {
            parentNode = new TreeNode();
            parentNode.id = currNode.parent.id;
          }
          currNode.parent = parentNode;
          parentNode.addChild(currNode);
          map[currNode.parent.id] = parentNode;
        }

        //set children
        if (currNode.children) {
          for (let i = 0; i < currNode.children.length; i++) {
            let childNode = map[currNode.children[i].id];
            childNode.parent = currNode;
            currNode.addChild(childNode);
            map[currNode.children[i].id] = childNode;
          }
        }

        map[nodeId] = currNode;
      }


      let nodeMaxChildren = null;
      for (let nodeId in map) {
        if (map[nodeId].children && !map[nodeId].parent) {
          if(nodeMaxChildren == null || nodeMaxChildren.children.length < map[nodeId].children.length)
            nodeMaxChildren = map[nodeId];
        }
      }
      return nodeMaxChildren;
    }

    private static addParentId(id: string) {
      let parentNode = new TreeNode;
      parentNode.id = id;
      return parentNode;
    }

  }

  //===================================================
  export class TreeNode {
    //required fields
    id: string;
    children: TreeNode[] = null;

    //optional fields:
    parent?: TreeNode = null;
    name?: string;
    weight?: number;

    deserialize(input) : TreeNode {
      Object.assign(this, input);

      if (!this.hasOwnProperty('id')) {
        throw new MissingFieldError('id');
      }
      if (!this.hasOwnProperty('children')) {
        throw new MissingFieldError('children');
      }

      this.parent = null;
      if (!this.hasOwnProperty('name')) {
        this.name = '';
      }
      this.weight = null;

      return this;
    }

    getParent(): TreeNode {
      return this.parent;
    }

    getChildren = () => {
      return this.children;
    };

    setParent(parent: TreeNode) {
      this.parent = parent;
    }

    //add child to current node
    addChild(child: TreeNode) {
      if (this.children == null)
        this.children = [];

      let childIndex = this.children.findIndex((value, index, object) => {
        return (value.id == child.id);
      });
      if (childIndex == -1)
        this.children.push(child);
      else
        this.children[childIndex] = child;
    }

    getId() {
      return this.id;
    }

    setChild(node: TreeNode) {
      if (this.children == null)
        return false;
      for (let i = 0; i < this.children.length; i++) {
        if (node.id == this.children[i].id) {
          node.parent = this;
          this.children[i] = node;
          return true;
        }
      }
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].setChild(node) == true)
          return true;
      }
      return false;
    }

    //add child node if it had property skos:inScheme
    addChildToScheme(node: TreeNode, parentId: string) {
      if (this.id == parentId) {
        this.addChild(node);
        return true;
      }
      if (this.children == null)
        return false;

      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].addChildToScheme(node, parentId) == true)
          return true;
      }

      return false;
    }
  }

  //===================================================
  export class Tree {
    private tree_: TreeNode = null;

    constructor(ok, filepath: string) {
      let xhr: XMLHttpRequest = new XMLHttpRequest();
      xhr.open('GET', filepath, true);
      xhr.onreadystatechange = () => {
        if (xhr.readyState == 4 && xhr.status == 200) {
          let content = xhr.responseText;
          let fileType : string = InputFile.determineFileType(content);

          if (fileType == InputFile.json) {
            this.tree_ = InputJSON.jsonToTree(content)[0];
            ok(this.tree_);
          } else if (fileType == InputFile.skos) {
            try {
              InputSkos.skosToTree(content, ok, this);
                      } catch(e) {
              console.log(e);
              console.log(e.stack);
            }
          } else if (fileType == InputFile.treeML) {
            InputTreeML.treemlToTree(content, ok, this);
          }
        }
      };
      xhr.send();
    }

    getRootNode() {
      return this.tree_;
    }

    countNodes(node : TreeNode) : number {
      let sum: number = 0;
      let children : TreeNode[] = node.children;
      children.forEach((child : TreeNode) => {
        sum += this.countNodes(child) + 1;
      });

      return sum;
    }

    setTree(tree: TreeNode) {
      this.tree_ = tree;
    }
  }


