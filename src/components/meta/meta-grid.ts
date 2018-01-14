
/*
implementierungen von: 

    rendering: new BarRow   (ui, e+=0,  'SVG',                 '<sub>#</sub>'),
    d3:        new BarRow   (ui, e+=re, 'D<sub>3</sub>',       '<sub>ms</sub>'),
    transform: new BarRow   (ui, e+=re, '∀<sub>visible</sub>', '<sub>ms</sub>'),     
    cullmaxw:  new SliderRow(ui, e+=re, 'ω<sub>cull</sub>',    '<sub>.5k</sub>', ωsliderInit, v=> `<sub>${v}</sub>`),
    lambda:    new SliderRow(ui, e+=6,  'λ',                   '<sub>1</sub>', λsliderInit, v=> `<sub>.${v*10}</sub>`),
    layout:    new BarRow   (ui, e+=6,  'Select',              '<sub>ms</sub>'),        
    degree:    new HistRow  (ui, e+=re, 'δ<sup>+</sup>',       '<sub>97</sub>'), 
    weights:   new HistRow  (ui, e+=7,  'ω',                   '<sub>34k</sub>'),
    heights:   new HistRow  (ui, e+=7,  'τ',                   '<sub>79</sub>'),
    data:      new BarRow   (ui, e+=7,  'Load',                '<sub>s</sub>'),
    lang:      new BarRow   (ui, e+=re, 'Lang',                '<sub>s</sub>'),
*/