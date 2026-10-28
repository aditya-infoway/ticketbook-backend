import { DataTypes, Sequelize } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes = {
    departmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "departmentId",
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "companyId",
    },
    financialYearId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "financialYearId",
    },
    departmentNo: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "departmentNo",
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
      type: DataTypes.TEXT,
      allowNull: true,
      field: "description",
    },
    departmentTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "departmentTypeId",
    },
    parentDepartmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "parentDepartmentId",
    },
    scope: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "scope",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Active",
      field: "status",
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "displayOrder",
    },
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "createdBy",
    },
    createdtype: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "createdtype",
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
      field: "created",
    },
    updated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated",
    },
    delete: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "delete",
    },
  };

  const options = {
    tableName: "department",
    comment: "",
    indexes: [
      { fields: ["companyId", "departmentNo"] },
      { fields: ["companyId", "departmentCode"] },
      { fields: ["companyId", "departmentTypeId"] },
      { fields: ["companyId", "parentDepartmentId"] },
    ],
  };

  return sequelize.define("department", attributes, options);
};