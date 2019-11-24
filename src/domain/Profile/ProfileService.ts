import ProfileEnum from "./ProfileEnum";
import DateService from "../../services/DateService"

class ProfileService {

    convertDateToHourNumber(date: Date, profileInterval = ProfileEnum.DEFAULT_PROFILE_INTERVAL): number {
        date = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDay(), date.getHours(),  Math.floor(date.getMinutes() / profileInterval) * profileInterval, 0, 0));
        const currentYearFirstDay = new Date(Date.UTC(2019, 0, 1)); //@TODO 2019

        let cycleNumber = 0;
        while (date >= currentYearFirstDay) {
            cycleNumber++;
            date = DateService.subtractDate(date, profileInterval, 'minutes')
        }

        return cycleNumber
    }

    convertDateToCycleNumber(date: Date, nowDate = DateService.getNowDate(), profileInterval = ProfileEnum.DEFAULT_PROFILE_INTERVAL): number | null {
        date = DateService.getDate(date.getTime())
        nowDate = DateService.getDate(nowDate.getTime())

        date.setMinutes(Math.floor(date.getMinutes() / profileInterval) * profileInterval);
        date.setSeconds(0);
        date.setMilliseconds(0);
        nowDate.setMinutes(Math.floor(nowDate.getMinutes() / profileInterval) * profileInterval);
        nowDate.setSeconds(0);
        nowDate.setMilliseconds(0);


        console.log('nowDate', nowDate);
        console.log('date', date);
        let cycleIterator = ProfileEnum.MAX_CYCLES;

        while (cycleIterator--) {
            if (date.getTime() == nowDate.getTime()) return cycleIterator
            nowDate = DateService.subtractDate(nowDate, profileInterval, 'minutes')
        }

        return null
    }

}

export default new ProfileService()
