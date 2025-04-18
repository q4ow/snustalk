import { PermissionFlagsBits } from "discord.js";

export const automodCommands = [
  {
    name: "automod-whitelist-role",
    description: "Add a role to filter-specific whitelist",
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      {
        name: "filter",
        description: "The filter type to whitelist the role for",
        type: 3,
        required: true,
        choices: [
          { name: "Spam", value: "spam" },
          { name: "Invites", value: "invites" },
          { name: "Mentions", value: "mentions" },
          { name: "Caps", value: "caps" },
          { name: "Links", value: "links" },
          { name: "Words", value: "words" },
        ],
      },
      {
        name: "role",
        description: "The role to whitelist",
        type: 8,
        required: true,
      },
    ],
  },
  {
    name: "automod-unwhitelist-role",
    description: "Remove a role from filter-specific whitelist",
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      {
        name: "filter",
        description: "The filter type to remove the role from",
        type: 3,
        required: true,
        choices: [
          { name: "Spam", value: "spam" },
          { name: "Invites", value: "invites" },
          { name: "Mentions", value: "mentions" },
          { name: "Caps", value: "caps" },
          { name: "Links", value: "links" },
          { name: "Words", value: "words" },
        ],
      },
      {
        name: "role",
        description: "The role to remove from whitelist",
        type: 8,
        required: true,
      },
    ],
  },
  {
    name: "automod-list-whitelists",
    description: "List all whitelisted roles for each filter",
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      {
        name: "filter",
        description: "The filter type to list whitelisted roles for (optional)",
        type: 3,
        required: false,
        choices: [
          { name: "Spam", value: "spam" },
          { name: "Invites", value: "invites" },
          { name: "Mentions", value: "mentions" },
          { name: "Caps", value: "caps" },
          { name: "Links", value: "links" },
          { name: "Words", value: "words" },
        ],
      },
    ],
  },
];
