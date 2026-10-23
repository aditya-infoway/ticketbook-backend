import { Sequelize, DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
  return sequelize.define(
    "admin",
    {
      adminId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      otp: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      profile: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      mobileNumber: {
        type: DataTypes.STRING(15),
        allowNull: true,
      },
      token: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      otpToken: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      otpExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      delete: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "admin",
      freezeTableName: true,
      timestamps: false,
    },
  );
};