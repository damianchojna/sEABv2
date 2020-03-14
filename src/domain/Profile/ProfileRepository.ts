import { Socket } from "net"
import ProfileDto from "./ProfileDto"
import ProfileService from "./ProfileService"
import ProfileEnum from "./ProfileEnum"
import DateService from "../../services/DateService"
import ProfileInterface from "./model/ProfileInterface"

class ProfileRepository {
    socket: Socket

    constructor(socket) {
        this.socket = socket
    }

    // async getProfileFromTheRange(dateStart: Date, dateEnd = DateService.getNowDate()): Promise<ProfileInterface[]> {
    //     console.log("getProfileFromTheRange")
    //
    //     console.log("dateStart", dateStart)
    //     const cycleStartNumber = ProfileService.convertDateToCycleNumber(dateStart)
    //     console.log("dateEnd", dateEnd)
    //     const cycleEndNumber = ProfileService.convertDateToCycleNumber(dateEnd)
    //
    //     let loopIteration = Math.ceil((cycleEndNumber - cycleStartNumber) / ProfileEnum.MAX_PROFILES_CAN_FETCH_DURING_ONE_REQUEST)
    //
    //     console.log("cycleStartNumber:", cycleStartNumber)
    //     console.log("cycleEndNumber:", cycleEndNumber)
    //     console.log("loopIteration:", loopIteration)
    //
    //     let cycleStartNumberForLoop = cycleStartNumber
    //     let profiles = []
    //
    //     while (loopIteration--) {
    //         console.log("loopIteration", loopIteration, cycleStartNumberForLoop)
    //         const profilesChunk = await this.getProfile(cycleStartNumberForLoop)
    //         cycleStartNumberForLoop += ProfileEnum.MAX_PROFILES_CAN_FETCH_DURING_ONE_REQUEST
    //
    //         console.log(profilesChunk)
    //         profiles.concat(profilesChunk)
    //     }
    //
    //     return profiles
    // }
}

export default ProfileRepository
