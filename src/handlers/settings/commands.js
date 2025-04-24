import { PermissionFlagsBits } from "discord.js";

export const settingsCommands = [
  {
    name: "settings",
    description: "Manage server settings",
    defaultMemberPermissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        name: "set",
        description: "Set a configuration value",
        type: 1,
        options: [
          {
            name: "type",
            description: "Setting type",
            type: 3,
            required: true,
            choices: [
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
              { name: "API Key", value: "api" },
              { name: "External Link", value: "link" },
            ],
          },
          {
            name: "name",
            description: "Setting name",
            type: 3,
            required: true,
          },
          {
            name: "value",
            description: "Setting value",
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: "get",
        description: "Get a configuration value",
        type: 1,
        options: [
          {
            name: "type",
            description: "Setting type",
            type: 3,
            required: true,
            choices: [
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
              { name: "API Key", value: "api" },
              { name: "External Link", value: "link" },
            ],
          },
          {
            name: "name",
            description: "Setting name",
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: "list",
        description: "List all settings",
        type: 1,
        options: [
          {
            name: "type",
            description: "Setting type (optional)",
            type: 3,
            required: false,
            choices: [
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
              { name: "API Key", value: "api" },
              { name: "External Link", value: "link" },
            ],
          },
        ],
      },
      {
        name: "remove",
        description: "Remove a setting",
        type: 1,
        options: [
          {
            name: "type",
            description: "Setting type",
            type: 3,
            required: true,
            choices: [
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
              { name: "API Key", value: "api" },
              { name: "External Link", value: "link" },
            ],
          },
          {
            name: "name",
            description: "Setting name",
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: "available-keys",
        description: "Show available setting keys",
        type: 1,
        options: [
          {
            name: "type",
            description: "Setting type",
            type: 3,
            required: true,
            choices: [
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
              { name: "API Key", value: "api" },
              { name: "External Link", value: "link" },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "setboostchannel",
    description: "Set a channel for server boost notifications",
    defaultMemberPermissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        name: "channel",
        description: "The channel for boost notifications",
        type: 7,
        required: true,
        channel_types: [0], // Text channels only
      },
    ],
  },
];
