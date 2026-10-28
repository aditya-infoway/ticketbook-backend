import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    departmentTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "departmentTypeId",
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "companyId",
    },

    // Department Type details
    typeCode: { type: DataTypes.STRING(50), allowNull: false, field: "typeCode" },
    typeName: { type: DataTypes.STRING(150), allowNull: false, field: "typeName" },
    description: { type: DataTypes.STRING(500), allowNull: true, field: "description" },
    displayOrder: { type: DataTypes.INTEGER, allowNull: true, field: "displayOrder" },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Active", // "Active" | "Inactive"
      field: "status",
    },

    created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    delete: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "delete" },
  };

  const options: ModelOptions = {
    tableName: "departmenttype",
    comment: "Department types (Support, Operations, ...)",
    indexes: [{ fields: ["companyId", "typeCode"] }],
  };

  const DepartmentTypeModel = sequelize.define("departmenttype", attributes, options);
  return DepartmentTypeModel;
};