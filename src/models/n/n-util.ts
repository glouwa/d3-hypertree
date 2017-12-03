/*
 * this class 
        - gets an intput path
        - reads the file containing a json tree representation
        - creates a tree hierarchy based on the data
 */

/*
 * node:
      must be in json file
      - id (unique)
      - parent
      - children

      are optional or not contained in json file
      - name
        - get a weight function and apply it to all elements -> if weight is undefined in child - call weight funciton on child, then finish parentRef weight computation

 *
 *//*
declare type WeightFunction = (node: TreeNode) => void;

class MissingFieldError extends Error {
  fieldname : string;
  constructor(field: string) {
    super(field);
    this.fieldname = field;
  }
}

class TreeNode {
  //required fields
  id : string;
  children : TreeNode[] = null;

  //optional fields:
  parent? : TreeNode = null;
  name? : string;
  weight? : number;

  deserialize(input) {
    Object.assign(this, input);

    if (!this.hasOwnProperty('id')){
      throw new MissingFieldError('id');
    }
    console.log('deserialize ' + this.id);
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

  getParent() : TreeNode {
    return this.parent;
  }

  getChildren() : TreeNode[] {
    return this.children;
  }

  setParent(parent : TreeNode) {
    //console.log('setParent ' + parent.getId() + ' of node ' + this.getId());
    this.parent = parent;
  }

  addChild(child : TreeNode) {
    //console.log('addChild ' + child.getId() + ' to node ' + this.getId());
    if (this.children.indexOf(child) == -1)
      this.children.push(child);
  }

  getId() : string {
    return this.id;
  }

  getChildCount() : number {
    let count : number = 0;
    this.children.forEach((child : TreeNode) => {
      //count += child.getChildCount();
    });

    return count;
  }
}


class Tree {
  private tree_ : TreeNode[] = [];

  constructor(ok, filepath: string) {
    let xhr: XMLHttpRequest = new XMLHttpRequest();
    xhr.open('GET', filepath, true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState == 4 && xhr.status == 200) {
        let json = JSON.parse(xhr.responseText);
        try {
          let _this = this;
          this.setupTreeHierarchy(json, null);
          console.log(this.tree_);
          ok(this.tree_[0]);
        } catch(e) {
          console.log("Invalid JSON data file.");
          console.log(e);
        }
      }
    };
    xhr.send();
  }

  private setupTreeHierarchy(json : Object[], parent : TreeNode) {
    json.forEach((obj : Object) => {
      let node = new TreeNode().deserialize(obj);

      let children : TreeNode[] = node.getChildren();
      if (children !== null) {
        this.setupTreeHierarchy(children, node);
      }

      if (parent !== null) {
        node.setParent(parent);
        parent.addChild(node);
      } else {
        this.tree_.push(node);
      }
    });
  }

  private getNodeById(id : string): TreeNode {
    return this.tree_.find((node : TreeNode) => (node.id == id));
  }

  computeWeight(callback: WeightFunction) {
    this.tree_.forEach((node : TreeNode) => callback(node));
  }

  getRouteNode() {
    return this.tree_.find((node : TreeNode) => (node.parent == null));
  }

  getNodeCount() {
    let count : number = 0;
    this.tree_.forEach((node: TreeNode) => {
       count += node.getChildCount();
    });
    return count;
  }

  getTree() : TreeNode[]{
    //console.log('getTree' + this.getNodeCount());
    return this.tree_;
  }

}


//TODO: get it working with JSON
//test all functions with JSON
//implement SKOS, TREEML
//implement treeoflife
//implement file system
*/

