export interface ILayer
{
    name:            string,
    args,
    updateTime?:     number,

    attach:          (parent)=> void,
    updateData:      ()=> void,
    updateTransform: ()=> void,
    updateColor:     ()=> void,
}
