import { DataTypes, Sequelize } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes = {
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "roleId",
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
    roleCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "roleCode",
    },
    roleName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "roleName",
    },
    roleCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "roleCategoryId",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "description",
    },
    defaultDataScope: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: "defaultDataScope",
    },
    departmentRestriction: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "all",
      field: "departmentRestriction",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Active",
      field: "status",
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
    tableName: "role",
    comment: "",
    indexes: [
      { fields: ["companyId", "roleCode"] },
      { fields: ["companyId", "roleCategoryId"] },
      { fields: ["companyId", "status"] },
    ],
  };

  return sequelize.define("role", attributes, options);
};