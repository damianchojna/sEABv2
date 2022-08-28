/*
 *   https://www.pozyton.com.pl/protokoly_transmisji_danych/protokol_transmisji_danych_sEAB_wer_MID_wer_od_02_09_do_02_12.pdf
 */

import sEABApiV2 from "./services/sEABApiV2/sEABApiV2"
import Logger from "./services/Logger/Logger"
import * as Influx from "influx"
import DateService from "./services/DateService"
import EnergyCounters from "./models/sequelize/EnergyCounters"
import sequelize from "./services/Sequelize/sequelize"
import {Op, literal, QueryTypes} from "sequelize"
import EnergySolarPanelCounters from "./models/sequelize/EnergySolarPanelCounters";

const configDevice1 = {
    serialNumber: "A523.1016498",
    port: 4001,
    influx: {
        fields: {
            activePower: "activePower",
            energyCounterInput: "energyCounterInput",
            energyCounterOutput: "energyCounterOutput",
            energyInput: "energyInput" ,
            energyOutput: "energyOutput"
        }
    },
    mysql: {
        table: EnergyCounters,
        tableName: EnergyCounters.tableName
    }
}

const configDevice2 = {
    serialNumber: "A523.1023158",
    port: 4003,
    influx: {
        fields: {
            activePower: "activePowerSolarPanel",
            energyCounterInput: "energyCounterInputSolarPanel",
            energyCounterOutput: "energyCounterOutputSolarPanel",
            energyInput: "energyInputSolarPanel" ,
            energyOutput: "energyOutputSolarPanel"
        }
    },
    mysql: {
        table: EnergySolarPanelCounters,
        tableName: EnergySolarPanelCounters.tableName
    }
}

const config = configDevice1

;(async () => {
    try {
        await sequelize.sync()

        const sEABApi = new sEABApiV2({
            ip: "moxa.lh",
            port: config.port,
            timeout: 5000,
            serialNumber: config.serialNumber
        })

        const influx = new Influx.InfluxDB({
            host: "nas.lh",
            username: "iot",
            password: "iot",
            database: "energy",
            schema: [
                {
                    measurement: "energy",
                    fields: {
                        [config.influx.fields.activePower]: Influx.FieldType.FLOAT,
                        [config.influx.fields.energyCounterInput]: Influx.FieldType.FLOAT,
                        [config.influx.fields.energyCounterOutput]: Influx.FieldType.FLOAT,
                    },
                    tags: ["device"]
                }
            ]
        })

        const names = await influx.getDatabaseNames()
        if (!names.includes("energy")) await influx.createDatabase("energy")

        const time = await sEABApi.getTime()

        let oldTime = DateService.getNowDate()
        // let energyCountesrTime = oldTime
        let toggleOneMeasurePerDay = true

        while (true) {
            try {
                const time = await sEABApi.getTime()

                const recordFromPreviousDate = await config.mysql.table.findOne({
                    order: [["createdAt", "DESC"]],
                    where: {
                        [Op.and]: [literal(`DATE(createdAt) < "${time.format("YYYY-MM-DD")}"`)]
                    },
                    raw: true
                })

                const recordFromToday = await config.mysql.table.findOne({
                    where: {
                        [Op.and]: [literal(`DATE(createdAt) = "${time.format("YYYY-MM-DD")}"`)]
                    }
                })

                const counterCurrentInput = await sEABApi.getEnergyCounter("P")
                const counterCurrentOutput = await sEABApi.getEnergyCounter("M")

                // Logger.log("One Day logger:", time.format("YYYY-MM-DD HH:mm:ss"))
                // Logger.log("recordFromPreviousDate", recordFromPreviousDate)
                // Logger.log("recordFromToday", recordFromToday ? recordFromToday.get({ plain: true }) : null)
                // Logger.log("counterCurrentInput", counterCurrentInput)
                // Logger.log("counterCurrentOutput", counterCurrentOutput)

                const calculatedEnergyInput = recordFromPreviousDate ? counterCurrentInput - recordFromPreviousDate.counterCurrentInput : 0
                const calculatedEnergyOutput = recordFromPreviousDate ? counterCurrentOutput - recordFromPreviousDate.counterCurrentOutput : 0

                if (recordFromToday) {
                    await sequelize.query(
                        "UPDATE `" + config.mysql.tableName + "` SET `counterCurrentInput`=?,`counterCurrentOutput`=?,`energyInput`=?,`energyOutput`=?, `createdAt`=?, `updatedAt`=? WHERE `id` = ?",
                        {
                            replacements: [
                                counterCurrentInput,
                                counterCurrentOutput,
                                calculatedEnergyInput,
                                calculatedEnergyOutput,
                                time.format("YYYY-MM-DD HH:mm:ss"),
                                time.format("YYYY-MM-DD HH:mm:ss"),
                                recordFromToday.id
                            ],
                            type: QueryTypes.UPDATE
                        }
                    )
                } else {
                    await sequelize.query(
                        "INSERT INTO `" + config.mysql.tableName + "` (`id`,`counterCurrentInput`,`counterCurrentOutput`,`energyInput`,`energyOutput`,`createdAt`, `measurementDate`) VALUES (DEFAULT,?,?,?,?,?,?)",
                        {
                            replacements: [
                                counterCurrentInput,
                                counterCurrentOutput,
                                calculatedEnergyInput,
                                calculatedEnergyOutput,
                                time.format("YYYY-MM-DD HH:mm:ss"),
                                time.format("YYYY-MM-DD")
                            ],
                            type: QueryTypes.INSERT
                        }
                    )
                }

                let energyCounterInput = null
                let energyCounterOutput = null
                // if (900000 <= time.getTime() - energyCounterTime.getTime()) {
                //     energyCounterInput = await sEABApi.getEnergyCounter("P")
                //     energyCounterOutput = await sEABApi.getEnergyCounter("M")
                //     Logger.log("Liczydło moc czynna, kierunek pobór:", energyCounterInput)
                //     Logger.log("Liczydło moc czynna, kierunek oddawanie:", energyCounterOutput)
                //     energyCounterTime = time
                // }

                if (oldTime.getTime() !== time.toDate().getTime()) {
                    const power = await sEABApi.getActivePower()

                    influx.writePoints([
                        {
                            // timestamp: time,
                            measurement: "power",
                            tags: {device: "seab"},
                            fields: {
                                [config.influx.fields.activePower]: power.SUM,
                                [config.influx.fields.energyInput]: calculatedEnergyInput,
                                [config.influx.fields.energyOutput]: calculatedEnergyOutput
                            }
                        }
                    ])
                    //Logger.log(`Moc Bierna ${time.format("YYYY-MM-DD HH:mm:ss")}:`, power)
                }
                oldTime = time.toDate()
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
