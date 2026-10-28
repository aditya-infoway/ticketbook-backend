import { DataTypes, Sequelize } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes = {
    roleCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "roleCategoryId",
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
    roleCategoryCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "roleCategoryCode",
    },
    roleCategoryName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "roleCategoryName",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "description",
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "displayOrder",
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
    tableName: "rolecategory",
    comment: "",
    indexes: [
      { fields: ["companyId", "roleCategoryCode"] },
      { fields: ["companyId", "displayOrder"] },
    ],
  };

  return sequelize.define("rolecategory", attributes, options);
};