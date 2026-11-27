import { N } from '../data/n'

export interface Path {    
    type:      string,
    id:        string,
    icon:      string,
    head:      N,
    headName:  string,
    ancestors: N[],
    color:     string
}