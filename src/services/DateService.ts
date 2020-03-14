import { Moment } from "moment"

const moment = require("moment")

class DateService {
    getNowDate(): Date {
        return moment.utc().toDate()
    }

    getDate(date: Date | string | number, format?: string): Date {
        return moment.utc(date, format).toDate()
    }

    parseDate(date: Date | string | number, format?: string): Moment {
        return moment(date, format)
    }

    subtractDate(date: Date | string | number, amount: number, unit = "days"): Date {
        return moment
            .utc(date)
            .subtract(amount, unit)
            .toDate()
    }
}

export default new DateService()
