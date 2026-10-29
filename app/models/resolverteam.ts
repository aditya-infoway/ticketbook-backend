import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    resolverTeamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "resolverTeamId",
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

    resolverTeamNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "resolverTeamNo",
    },
    
    teamName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "teamName",
    },
    teamDescription: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "teamDescription",
    },

    teamCode: {
  type: DataTypes.STRING(50),
  allowNull: true, // purane records ke liye null chalega
  field: "teamCode",
},

// purana single department: ab sirf legacy, naya code ise use nahi karega
departmentId: {
  type: DataTypes.INTEGER,
  allowNull: true, // pehle false tha
  field: "departmentId",
},
departmentIds: {
  type: DataTypes.TEXT,
  allowNull: true,
  field: "departmentIds",
},
    teamLeaderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "teamLeaderId",
    }, // employee

    coverageType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "All", // "All" | "Specific"
      field: "coverageType",
    },
    regionId: { type: DataTypes.INTEGER, allowNull: true, field: "regionId" },
    teamMemberIds: {
      type: DataTypes.TEXT,
      allowNull: true,                                                    
      field: "teamMemberIds",
    },
    assignedBranchIds: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "assignedBranchIds",
    },
    assignmentMethod: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Auto", // "Auto" | "Manual"
      field: "assignmentMethod",
    },
    teamEmail: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "teamEmail",
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
    tableName: "resolverteam",
    comment: "Resolver teams (ticket resolution groups)",
    indexes: [{ fields: ["companyId", "teamName"] }],
  };

  const ResolverTeamModel = sequelize.define(
    "resolverteam",
    attributes,
    options,
  );
  return ResolverTeamModel;
};
