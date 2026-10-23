import { Sequelize, DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
  return sequelize.define(
    "company",
    {
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },

      // ---- Company Information ----
      companyName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      companyAddress: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      contactNumber: {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
      },
      businessEmail: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      ownerName: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      ownerContactNumber: {
        type: DataTypes.STRING(15),
        allowNull: false,
      },
      ownerEmail: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      country: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      district: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      taluka: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },

      // ---- Business Information ----
      registrationDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      expiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      businessType: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      employeeSize: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      gstNumber: {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
      },
      panNumber: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true,
      },
      aadhaarNumber: {
        type: DataTypes.STRING(12),
        allowNull: false,
        unique: true,
      },

      // ---- Login Information ----
      email: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING(255), // bcrypt hash
        allowNull: false,
      },
      token: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      tokenDate: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      otp: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "PENDING", // PENDING | APPROVED | REJECTED
      },

      created: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      delete: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "company",
      freezeTableName: true,
      timestamps: false,
    },
  );
};
