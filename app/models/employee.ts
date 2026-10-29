import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "employeeId",
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

    // Auto number (prefix + FY + running no.) and manually typed code
    employeeNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "employeeNo",
    },
    employeeCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "employeeCode",
    },
    employeeName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "employeeName",
    },
    profilePhoto: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "profilePhoto",
    },
    branchId: { type: DataTypes.INTEGER, allowNull: true, field: "branchId" },
    // Login id (unique when present) + hashed password
    officialEmail: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "officialEmail",
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "password",
    }, // bcrypt hash

    // Login session (same idea as company.token / tokenDate)
   token: { type: DataTypes.TEXT, allowNull: true, field: "token" },
    tokenDate: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: "tokenDate",
    },

    mobileCountryCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: "mobileCountryCode",
    },
    mobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "mobileNumber",
    },
    alternateCountryCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: "alternateCountryCode",
    },
    alternateContact: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "alternateContact",
    },

    employeeTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "employeeTypeId",
    },
    designationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "designationId",
    },

    dateOfJoining: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "dateOfJoining",
    },
    employmentStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Active", // "Active" | "Inactive"
      field: "employmentStatus",
    },
    employmentEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "employmentEndDate",
    },
    remarks: { type: DataTypes.STRING(500), allowNull: true, field: "remarks" },

    roleCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "roleCategoryId",
    },
    roleId: { type: DataTypes.INTEGER, allowNull: true, field: "roleId" },

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
    tableName: "employee",
    comment: "Employees (login via officialEmail + password)",
    indexes: [
      { fields: ["companyId", "employeeCode"] },
      { fields: ["officialEmail"] },
    ],
  };

  const EmployeeModel = sequelize.define("employee", attributes, options);
  return EmployeeModel;
};
