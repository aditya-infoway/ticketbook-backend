import { DataTypes, Sequelize } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes = {
    regionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "regionId",
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

    regionNo: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "regionNo",
    },

    regionName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "regionName",
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
    tableName: "region",
    comment: "",

    indexes: [
      {
        fields: ["companyId", "regionNo"],
      },
      {
        fields: ["companyId", "regionName"],
      },
    ],
  };

  return sequelize.define("region", attributes, options);
};
