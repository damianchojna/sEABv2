import { Sequelize } from "sequelize"

const sequelize = new Sequelize("energy", "energy", "energy", {
    host: "192.168.0.30",
    dialect: "mysql",
    //operatorsAliases: false,

    timezone: "+01:00",

    pool: {
        max: 2,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
})

export default sequelize
