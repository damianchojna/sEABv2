import ProfileInterface from "./model/ProfileInterface"
import DateService from "../../services/DateService"

class ProfileDto {
    apiResponseToProfileModel(matches: string[], profileInterval = 15): ProfileInterface {
        if (!matches) return null

        const firstDayOfYear = DateService.getDate("01-01-" + matches[1] + " 00:00:00", "DD-MM-YY HH:mm:ss")
        let quarterHourNumber = parseInt(matches[2], 16)

        const calculatedDateFromQuarterHourNumber = firstDayOfYear
        for (let i = quarterHourNumber; i > 0; i--) {
            calculatedDateFromQuarterHourNumber.setMinutes(calculatedDateFromQuarterHourNumber.getMinutes() + profileInterval)
        }
        calculatedDateFromQuarterHourNumber.setSeconds(calculatedDateFromQuarterHourNumber.getSeconds() - 1) //@TODO FIX Offset +1 hour

        return {
            year: firstDayOfYear.getFullYear(),
            quarterHourNumber: quarterHourNumber,
            date: calculatedDateFromQuarterHourNumber,
            "P+": parseInt(matches[3], 16),
            "P-": parseInt(matches[4], 16),
            "Q+": parseInt(matches[5], 16),
            "Q-": parseInt(matches[6], 16),
            "SUM_EP+": parseInt(matches[7], 16),
            "SUM_EP-": parseInt(matches[8], 16),
            "SUM_EQ+": parseInt(matches[9], 16),
            "SUM_EQ-": parseInt(matches[10], 16),
            cycleStatus: parseInt(matches[11], 16).toString(2)
        }
    }
}

export default new ProfileDto()

/* old

    const re = /^\x02232\.0\(([0-1]{8})\)\r\n3\.4\.0\.1\(([0-9]{2})([0-9A-F]{4});([0-9A-F]{4});([0-9A-F]{4});([0-9A-F]{4});([0-9A-F]{4});([0-9A-F]{8});([0-9A-F]{8});([0-9A-F]{8});([0-9A-F]{8});([0-9A-F]{4})\)/;
    const matches = dataProfiles.toString().match(re);

    const result = {
        year: matches[2],
        quarterHourNumber: parseInt(matches[3], 16),
        "P+":  parseInt(matches[4], 16),
        "P-":  parseInt(matches[5], 16),
        "Q+":  parseInt(matches[6], 16),
        "Q-":  parseInt(matches[7], 16),
        "SUM_EP+":  parseInt(matches[8], 16),
        "SUM_EP-":  parseInt(matches[9], 16),
        "SUM_EQ+":  parseInt(matches[10], 16),
        "SUM_EQ-":  parseInt(matches[11], 16),
        cycleStatus:  parseInt(matches[12], 16).toString(2)
    }

 */
