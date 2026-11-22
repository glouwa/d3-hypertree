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
 */

