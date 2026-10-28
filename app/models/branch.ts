import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    branchId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "branchId",
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

    // Auto number (prefix + FY + running no.) and editable code
    branchNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "branchNo",
    },
    branchCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "branchCode",
    },
    branchName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "branchName",
    },

    // Region / Area comes from the region table
    regionId: { type: DataTypes.INTEGER, allowNull: true, field: "regionId" },

    country: { type: DataTypes.STRING(100), allowNull: true, field: "country" },
    state: { type: DataTypes.STRING(100), allowNull: true, field: "state" },
    city: { type: DataTypes.STRING(100), allowNull: true, field: "city" },
    fullAddress: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "fullAddress",
    },
    pinCode: { type: DataTypes.STRING(20), allowNull: true, field: "pinCode" },

    contactNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "contactNumber",
    },
    phoneNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "phoneNumber",
    },

    // Branch panel login
    branchEmail: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "branchEmail",
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password",
    }, // bcrypt hash
    // Session token (JWT). TEXT, kyunki JWT 100 chars se lamba hota hai
    token: { type: DataTypes.TEXT, allowNull: true, field: "token" },
    tokenDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "tokenDate",
    },
    // Kept as strings until the employee dropdown is wired to real ids
    branchManagerId: { type: DataTypes.INTEGER, allowNull: true },
    areaManagerId: { type: DataTypes.INTEGER, allowNull: true },

    openingDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "openingDate",
    },
    workingHours: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "workingHours",
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
    tableName: "branch",
    comment: "Branches (login via branchEmail + password)",
    indexes: [
      { fields: ["companyId", "branchCode"] },
      { fields: ["branchEmail"] },
    ],
  };

  const BranchModel = sequelize.define("branch", attributes, options);
  return BranchModel;
};
