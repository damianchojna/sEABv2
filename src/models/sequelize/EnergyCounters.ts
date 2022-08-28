import { Sequelize, Model, DataTypes, BuildOptions } from "sequelize"
import {
    HasManyGetAssociationsMixin,
    HasManyAddAssociationMixin,
    HasManyHasAssociationMixin,
    Association,
    HasManyCountAssociationsMixin,
    HasManyCreateAssociationMixin
} from "sequelize"

class EnergyCounters extends Model {
    public id!: number
    public counterCurrent!: number
    public counterPrev!: number
    public energyInput!: number
    public energyOutput!: number
    public readonly createdAt!: Date
    public readonly updatedAt!: Date
}
import sequelize from "../../services/Sequelize/sequelize"

EnergyCounters.init(
    {
        id: {
            type: DataTypes.FLOAT, // you can omit the `new` but this is discouraged
            autoIncrement: true,
            primaryKey: true
        },
        counterCurrentInput: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        counterCurrentOutput: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        energyInput: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        energyOutput: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
        },
        measurementDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: "counters",
        createdAt: "createdAt",
        updatedAt: "updatedAt"
    }
)

export default EnergyCounters
