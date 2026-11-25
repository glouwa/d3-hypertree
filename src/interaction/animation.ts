// Animations of the view (goto, gotoλ, animateUp): one frame per animation frame,
// progress 0..1 over interaction.animationDuration, cancelled by a pointer.

export interface AnimationHost {
    transition: Transition
    log: any[]
}

export class Transition
{
    public hypertree : AnimationHost
    public type : 'animation' | 'interaction' | 'script'
    public frames : Frame[] = []
    public lowdetail = true
    public currentframe : Frame
    public beginTime
    public endTime

    constructor(hypertree:AnimationHost)
    {
        this.hypertree = hypertree
    }

    protected begin()
    {
        this.beginTime = performance.now()
    }

    protected end()
    {
        this.currentframe = undefined
        if (this.hypertree.transition === this)   // not a newer one started after a cancel
            this.hypertree.transition = undefined
    }

    // stops the animation at its current state (its next frame ends it, resolved)
    public cancelled = false
    public cancel() { this.cancelled = true }
}

export class Frame
{
    nr: number
    created: number
    begin: number
    end: number
    calculations: number
    uiupdate: number
    cachestats: {
        n,
    }
    constructor(nr:number)
    {
        this.nr = nr
        this.created = performance.now()
    }
}

export interface AnimationArgs {
    name:      string
    hypertree: AnimationHost
    duration:  number
    resolve:   ()=> void
    reject:    (e?)=> void
    frame:     (progress01:number)=> void
}

export class Animation extends Transition
{
    resolve
    reject
    constructor(args:AnimationArgs)
    {
        super(args.hypertree)
        if (args.hypertree.transition) {
            console.warn("d3-hypertree: an animation is already running, the new one is ignored")
            return
        }

        args.hypertree.transition = this
        this.hypertree.log.push(this.hypertree.transition)

        const frame = ()=>
        {
            if (this.cancelled) {   // stopAnimation: a pointer took over
                this.end()
                args.resolve()
                return
            }
            this.currentframe = new Frame(0)
            this.frames.push(this.currentframe)

            const now = performance.now()
            if (!this.beginTime) {
                this.begin()
                this.endTime = now + args.duration
            }

            const done = now - this.beginTime
            const p01 = done / args.duration

            if (now > this.endTime) {
                args.frame(1)
                this.end()
                args.resolve()
            }
            else {
                args.frame(p01)
                requestAnimationFrame(()=> frame())
            }

            this.currentframe = undefined
        }

        requestAnimationFrame(()=> frame())
    }
}
