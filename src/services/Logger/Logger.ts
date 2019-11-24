/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as chalk from "chalk"
import * as util from "util"

export default class Logger {
    public static debugEnabled: boolean = true

    public static error(message: string, ...metadata: any[]): void {
        console.error(chalk.bgRed.hex("#FFFFFF")(message), metadata.length > 0 ? chalk.red(util.inspect(metadata, false, null, false)) : "")
    }

    public static log(message: string, ...metadata: any[]): void {
        console.log(chalk.bgBlue.hex("#FFFFFF")(message), metadata.length > 0 ? chalk.blue(util.inspect(metadata, false, null, false)) : "")
    }

    public static debug(message: string, ...metadata: any[]): void {
        if (Logger.debugEnabled)
            console.debug(
                chalk.bgMagenta.hex("#FFFFFF")(message),
                metadata.length > 0 ? chalk.magenta(util.inspect(metadata, false, null, false)) : ""
            )
    }
}
