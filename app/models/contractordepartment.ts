import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    contractorDepartmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "contractorDepartmentId",
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
    contractorDepartmentNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "contractorDepartmentNo",
    },
    departmentCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "departmentCode",
    },
    departmentName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "departmentName",
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "description",
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
    tableName: "contractordepartment",
    comment: "Contractor departments",
    indexes: [
      { fields: ["companyId", "departmentCode"] },
      { fields: ["companyId", "contractorDepartmentNo"] },
    ],
  };

  return sequelize.define("contractordepartment", attributes, options);
};
