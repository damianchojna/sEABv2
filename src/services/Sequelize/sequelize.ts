import { Sequelize } from "sequelize"

const sequelize = new Sequelize("energy", "iot", "iot", {
    host: "nas.lh",
    dialect: "mysql",
    //operatorsAliases: false,

    logging: false,
    timezone: "+01:00",

    pool: {
        max: 2,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
})

export default sequelize
