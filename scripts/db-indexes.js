// MongoDB index plan for RhinoPeak.
// Usage:
//   mongosh "$RHINOPEAK_MONGO_URI/$RHINOPEAK_MONGO_DB_NAME" scripts/db-indexes.js

db.workspaces.createIndex({ id: 1 }, { unique: true });
db.workspaces.createIndex({ plan: 1, status: 1 });
db.workspaces.createIndex({ subscriptionStatus: 1, plan: 1 });
db.workspaces.createIndex({ createdAt: -1 });

db.businesses.createIndex({ id: 1 }, { unique: true });
db.businesses.createIndex({ workspaceId: 1, createdAt: 1 });

db.roles.createIndex({ id: 1 }, { unique: true });
db.roles.createIndex({ workspaceId: 1, name: 1 }, { unique: true });
db.roles.createIndex({ workspaceId: 1, systemRole: -1 });

db.users.createIndex({ id: 1 }, { unique: true });
db.users.createIndex({ emailNormalized: 1 }, { unique: true });
db.users.createIndex({ workspaceId: 1, role: 1 });
db.users.createIndex({ workspaceId: 1, status: 1 });
db.users.createIndex({ lastActive: -1 });
db.users.createIndex({ lastLoginAt: -1 });

db.sessions.createIndex({ accessTokenHash: 1 }, { unique: true });
db.sessions.createIndex({ refreshTokenHash: 1 }, { unique: true });
db.sessions.createIndex({ userId: 1 });
db.sessions.createIndex({ revokedAt: 1 });
db.sessions.createIndex({ expiresAt: 1 });

db.password_reset_tokens.createIndex({ id: 1 }, { unique: true });
db.password_reset_tokens.createIndex({ userId: 1, tokenHash: 1, usedAt: 1 });
db.password_reset_tokens.createIndex({ expiresAt: 1 });

db.payment_sessions.createIndex({ transactionUuid: 1 }, { unique: true });
db.payment_sessions.createIndex({ workspaceId: 1, createdAt: -1 });
db.payment_sessions.createIndex({ status: 1, gateway: 1 });

db.records.createIndex({ workspaceId: 1, kind: 1, id: 1 }, { unique: true });
db.records.createIndex({ workspaceId: 1, kind: 1, createdAt: -1 });
db.records.createIndex({ workspaceId: 1, kind: 1, updatedAt: -1 });
db.records.createIndex({ workspaceId: 1, kind: 1, "payload.date": -1 });
db.records.createIndex({ workspaceId: 1, kind: 1, "payload.customerId": 1 });
db.records.createIndex({ workspaceId: 1, kind: 1, "payload.supplierId": 1 });
db.records.createIndex({ workspaceId: 1, kind: 1, "payload.sku": 1 });
db.records.createIndex({ workspaceId: 1, kind: 1, "payload.status": 1 });
db.records.createIndex(
  { workspaceId: 1, kind: 1, "payload.operationKey": 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: "sync_operations",
      "payload.operationKey": { $exists: true }
    }
  }
);

db.audit_logs.createIndex({ workspaceId: 1, timestamp: -1 });
db.audit_logs.createIndex({ "actor.id": 1, timestamp: -1 });
db.audit_logs.createIndex({ action: 1, timestamp: -1 });
db.audit_logs.createIndex({ module: 1, timestamp: -1 });
db.audit_logs.createIndex({ success: 1, timestamp: -1 });

db.platform_admins.createIndex({ id: 1 }, { unique: true });
db.platform_admins.createIndex({ emailNormalized: 1 }, { unique: true });
db.platform_admins.createIndex({ role: 1, status: 1 });

db.platform_feature_flags.createIndex({ id: 1 }, { unique: true });
db.platform_feature_flags.createIndex({ area: 1, enabled: 1 });

db.platform_sessions.createIndex({ accessTokenHash: 1 }, { unique: true });
db.platform_sessions.createIndex({ adminId: 1 });
db.platform_sessions.createIndex({ revokedAt: 1 });
