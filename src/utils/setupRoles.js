import { PermissionFlagsBits } from "discord.js";
import { db } from "./database.js";

const DEFAULT_ROLES = {
  verified: {
    name: "Verified",
    color: "#2ECC71",
    reason: "Auto-created verified role",
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ],
  },
  unverified: {
    name: "Unverified",
    color: "#95A5A6",
    reason: "Auto-created unverified role",
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
    ],
  },
};

export async function ensureGuildRoles(guild) {
  try {
    const settings = await db.getGuildSettings(guild.id);
    const updates = { role_ids: { ...settings.role_ids } };
    let rolesCreated = false;

    await guild.roles.fetch();

    for (const [roleType, roleConfig] of Object.entries(DEFAULT_ROLES)) {
      const roleId = settings.role_ids?.[roleType];

      let existingRole = null;
      if (roleId) {
        existingRole = await guild.roles.fetch(roleId).catch(() => null);
      }

      if (!existingRole) {
        const roleByName = guild.roles.cache.find(
          (role) => role.name.toLowerCase() === roleConfig.name.toLowerCase(),
        );

        if (roleByName) {
          existingRole = roleByName;
          updates.role_ids[roleType] = roleByName.id;
          rolesCreated = true;
        } else {
          try {
            const newRole = await guild.roles.create({
              name: roleConfig.name,
              color: roleConfig.color,
              reason: roleConfig.reason,
              permissions: roleConfig.permissions,
            });

            updates.role_ids[roleType] = newRole.id;
            rolesCreated = true;
          } catch (error) {
            console.error(`Error creating ${roleType} role:`, error);
            if (error.code === 50013) {
              console.error("Bot lacks permissions to create roles");
            }
            throw error;
          }
        }
      }
    }

    if (rolesCreated) {
      await db.updateGuildSettings(guild.id, updates);
    }

    return updates.role_ids;
  } catch (error) {
    console.error(`Failed to ensure roles for guild ${guild.name}:`, error);
    throw error;
  }
}
