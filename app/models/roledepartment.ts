import { DataTypes, Sequelize } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes = {
    roleDepartmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "roleDepartmentId",
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "companyId",
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "roleId",
    },
    departmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "departmentId",
    },
    created: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created",
    },
    delete: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "delete",
    },
  };

  const options = {
    tableName: "roledepartment",
    comment: "",
    indexes: [
      { fields: ["companyId", "roleId"] },
      { fields: ["companyId", "departmentId"] },
    ],
  };

  return sequelize.define("roledepartment", attributes, options);
};