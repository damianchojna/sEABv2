/*
 *   https://www.pozyton.com.pl/protokoly_transmisji_danych/protokol_transmisji_danych_sEAB_wer_MID_wer_od_02_09_do_02_12.pdf
 */
import SocketPromise from "socket-promise"

import sEABApiV2 from "./services/sEABApiV2/sEABApiV2"
import Logger from "./services/Logger/Logger"
import * as Influx from "influx"
import DateService from "./services/DateService"
import EnergyCounters from "./models/sequelize/EnergyCounters"
import sequelize from "./services/Sequelize/sequelize"
;(async () => {
    try {
        await sequelize.sync()

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
                        activePower: Influx.FieldType.FLOAT,
                        energyCounterInput: Influx.FieldType.FLOAT,
                        energyCounterOutput: Influx.FieldType.FLOAT
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
        // let energyCounterTime = oldTime
        let toggleOneMeasurePerDay = true
        while (true) {
            try {
                const time = await sEABApi.getTime()

                if (0 == time.getHours() && toggleOneMeasurePerDay) {
                    const lastEnergyRecord = await EnergyCounters.findOne({
                        order: [["createdAt", "DESC"]]
                    })

                    const counterCurrentInput = await sEABApi.getEnergyCounter("P")
                    const counterCurrentOutput = await sEABApi.getEnergyCounter("M")

                    Logger.log("One Day logger:", time.toISOString())
                    Logger.log("lastEnergyRecord.counterCurrentInput", lastEnergyRecord.counterCurrentInput)
                    Logger.log("lastEnergyRecord.counterCurrentInput", lastEnergyRecord.counterCurrentInput)
                    Logger.log("counterCurrentInput", counterCurrentInput)
                    Logger.log("counterCurrentOutput", counterCurrentOutput)

                    await EnergyCounters.create({
                        counterCurrentInput,
                        counterCurrentOutput,
                        energyInput: lastEnergyRecord ? counterCurrentInput - lastEnergyRecord.counterCurrentInput : 0,
                        energyOutput: lastEnergyRecord ? counterCurrentOutput - lastEnergyRecord.counterCurrentOutput : 0
                    })

                    toggleOneMeasurePerDay = false
                }
                if (0 != time.getHours()) toggleOneMeasurePerDay = true

                let energyCounterInput = null
                let energyCounterOutput = null
                // if (900000 <= time.getTime() - energyCounterTime.getTime()) {
                //     energyCounterInput = await sEABApi.getEnergyCounter("P")
                //     energyCounterOutput = await sEABApi.getEnergyCounter("M")
                //     Logger.log("Liczydło moc czynna, kierunek pobór:", energyCounterInput)
                //     Logger.log("Liczydło moc czynna, kierunek oddawanie:", energyCounterOutput)
                //     energyCounterTime = time
                // }

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
                    Logger.log(`Moc Bierna ${time.toISOString()}:`, power)
                }
                oldTime = time
            } catch (e) {
                Logger.error("Error main app lopp", e)

                //@TODO Error [ERR_STREAM_DESTROYED]: Cannot call write after a stream was destroyed
                //sEABApiV2.<anonymous> (/home/pi/work/seab/src/services/sEABApiV2/sEABApiV2.ts:137:27)

                sEABApi.disconnect()
                process.exit()
            }
        }

        // const standardDataSet = await sEABApi.getStandardDataSet()
        // Logger.log("standardowy zestaw danych:", standardDataSet)
    } catch (err) {
        // if (err instanceof SocketPromise.errors.Timeout) {
        //     console.log("Connect Timeout") // after 5 seconds
        // } else if (err instanceof SocketPromise.errors.Closed) {
        //     console.log("Connection Closed")
        // } else {
        //     console.log(err)
        // }
        Logger.error("App main catch", err)
        process.exit()
    }
})()
