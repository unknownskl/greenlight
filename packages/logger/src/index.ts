import Sink, { SinkData } from './sink'

export default class Logger {
    // _logger:Debug;
    private _sink:Sink
    public name:string

    private _enableStdout:boolean = false

    constructor(name:string){
        this._sink = new Sink(name)
        this.name = name

        const debugSelector = (process.env.DEBUG_GREENLIGHT !== undefined) ? process.env.DEBUG_GREENLIGHT : process.env.DEBUG
        const debugArgs = debugSelector?.split(',')
        if(debugArgs !== undefined && (debugArgs.includes(this.name) || debugArgs.includes('*'))) {
            this._enableStdout = true
        }
    }

    logEncoder(...args:any[]) {
        args = args.map(arg => {
            return (typeof arg === 'string') ? arg : (arg instanceof Error) ? arg.stack : JSON.stringify(arg, undefined, 2)
        })
        return args
    }

    log(...args:any[]) {
        args = this.logEncoder(...args)
        const logLine = this._sink.addLog(args.join(" "))
        if(this._enableStdout === true) {
            this.displayLogLine(logLine)
        }
        
        return logLine
    }

    warn(...args:any[]) {
        args = this.logEncoder(...args)
        const logLine = this._sink.addLog('\x1b[33m'+"[WARNING]"+'\x1b[0m '+args.join(" "))
        if(this._enableStdout === true) {
            this.displayLogLine(logLine)
        }
        
        return logLine
    }

    error(...args:any[]) {
        args = this.logEncoder(...args)
        const logLine = this._sink.addLog('\x1b[31m'+"[ERROR]"+'\x1b[0m '+args.join(" "))
        if(this._enableStdout === true) {
            this.displayLogLine(logLine)
        }
        
        return logLine
    }

    extend(name:string) {
        return new Logger(this.name + ':' + name)
    }

    display() {
        const sinkData = this._sink.getData()
        for(const log in sinkData){
            const logLine = sinkData[parseInt(log)]

            this.displayLogLine(logLine)
        }
    }

    displayLogLine(logLine:SinkData) {
        logLine.data = logLine.data.replace(/\n/g, "\r\n" + ' '.repeat(this.name.length+3))

        let timestampSinceLastLog = logLine.timestampSinceLastLog*1000
        let timestampSinceLastLogUnit = "us"
        if(timestampSinceLastLog > 1000) {
            timestampSinceLastLog = logLine.timestampSinceLastLog
            timestampSinceLastLogUnit = "ms"
        }

        let stdout = '\x1b[36m'+"["+this.name+"]"+'\x1b[0m'+" "+logLine.data+" \x1b[90m(+"+timestampSinceLastLog + " " + timestampSinceLastLogUnit + ")\x1b[0m"

        console.log(stdout)
    }
}