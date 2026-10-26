import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    regionTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "regionTypeId",
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "companyId",
    },

    // Region Type details
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

    // Audit
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: "createdBy" },
    createdType: { type: DataTypes.STRING(30), allowNull: true, field: "createdType" },

    created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    delete: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "delete" },
  };

  const options: ModelOptions = {
    tableName: "regiontype",
    comment: "Region / Area types (North Region, South Region, ...)",
    indexes: [{ fields: ["companyId", "typeCode"] }],
  };

  const RegionTypeModel = sequelize.define("regiontype", attributes, options);
  return RegionTypeModel;
};