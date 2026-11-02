import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    areaManagerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "areaManagerId",
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "companyId",
    },
    financialYearId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "financialYearId",
    },

    areaManagerNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "areaManagerNo",
    },

    name: { type: DataTypes.STRING(150), allowNull: false, field: "name" },
    profilePhoto: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "profilePhoto",
    },
    gender: { type: DataTypes.STRING(20), allowNull: true, field: "gender" },

    mobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: "mobileNumber",
    },
    alternateMobile: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "alternateMobile",
    },
    email: { type: DataTypes.STRING(150), allowNull: false, field: "email" },
    address: { type: DataTypes.STRING(250), allowNull: true, field: "address" },
    city: { type: DataTypes.STRING(50), allowNull: true, field: "city" },
    state: { type: DataTypes.STRING(50), allowNull: true, field: "state" },
    pinCode: { type: DataTypes.STRING(10), allowNull: true, field: "pinCode" },

    // Area = region table
    areaId: { type: DataTypes.INTEGER, allowNull: false, field: "areaId" },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "description",
    },
    joiningDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "joiningDate",
    },

    // Area manager panel login: email + password
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password",
    }, // bcrypt hash
    loginAccess: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "loginAccess",
    },
    // Login session (same idea as employee.token / tokenDate)
    token: { type: DataTypes.TEXT, allowNull: true, field: "token" },
    tokenDate: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: "tokenDate",
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Active", // "Active" | "Inactive"
      field: "status",
    },

    // Audit
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "createdBy",
    },
    createdType: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: "createdType",
    },
    updatedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "updatedBy",
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
      field: "delete",
    },
  };

  const options: ModelOptions = {
    tableName: "areamanager",
    comment: "Area managers (login via username + password)",
    indexes: [
      { fields: ["companyId", "areaManagerNo"] },
      { fields: ["companyId", "areaId"] },
      { fields: ["email"] },
    ],
  };

  return sequelize.define("areamanager", attributes, options);
};
