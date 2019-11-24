/*
 *   https://www.pozyton.com.pl/protokoly_transmisji_danych/protokol_transmisji_danych_sEAB_wer_MID_wer_od_02_09_do_02_12.pdf
 */
import SocketPromise from "socket-promise"

import sEABApiV2 from "./services/sEABApiV2/sEABApiV2"
import Logger from "./services/Logger/Logger"
import * as Influx from "influx"
import DateService from "./services/DateService"
;(async () => {
    try {
        const sEABApi = new sEABApiV2({
            ip: "192.168.0.40",
            port: 4001,
            timeout: 5000,
            serialNumber: "A523.1016498"
        })

        const influx = new Influx.InfluxDB({
            host: "localhost",
            database: "energy",
            schema: [
                {
                    measurement: "energy",
                    fields: {
                        activePower: Influx.FieldType.FLOAT
                    },
                    tags: ["device"]
                }
            ]
        })

        const names = await influx.getDatabaseNames()
        if (!names.includes("energy")) await influx.createDatabase("energy")

        const time = await sEABApi.getTime()
        Logger.log("Czas na liczniku:", time)

        let oldTime = DateService.getNowDate()
        while (true) {
            try {
                const time = await sEABApi.getTime()
                if (oldTime.getTime() !== time.getTime()) {
                    const power = await sEABApi.getActivePower()
                    influx.writePoints([
                        {
                            // timestamp: time,
                            measurement: "power",
                            tags: { device: "seab" },
                            fields: {
                                activePower: power.SUM
                            }
                        }
                    ])
                    Logger.log("Moc Bierna:", power)
                }
                oldTime = time
            } catch (e) {
                Logger.error("Error main app lopp", e)
                sEABApi.disconnect()
            }
        }

        // const standardDataSet = await sEABApi.getStandardDataSet()
        // Logger.log("standardowy zestaw danych:", standardDataSet)
    } catch (err) {
        // if (err instanceof SocketPromise.errors.Timeout) {
        //     console.log('Connect Timeout'); // after 5 seconds
        // } else if (err instanceof SocketPromise.errors.Closed) {
        //     console.log('Connection Closed');
        // } else {
        //     console.log(err)
        // }
        Logger.error("App main catch", err)
        process.exit()
    }
})()
