# SnusTalk Central Bot

A Discord bot built with discord.js, originally developed for the SnusTalk Central server but available for anyone to use and modify under the MIT license.

## Features

### Currently Implemented
- **Verification System**
  - Reaction-based verification
  - Automatic role assignment
  - DM confirmation with optional RestoreCore backup

- **Welcome System**
  - Customizable welcome messages
  - Member count tracking
  - Automatic unverified role assignment

- **Ticket System**
  - Two-tier support system (General & Management)
  - Ticket claiming system
  - Transcript logging
  - Automatic category and permission management
  - Staff role notifications

- **Server Statistics**
  - Member count tracking
  - Bot count tracking
  - Total tickets tracking
  - Open tickets tracking

- **Moderation**
  - Message purging command
  - Channel lock/unlock
  - Nickname management

- **Utility Commands**
  - User information
  - Server information
  - Avatar display
  - Bot latency check

## Setup Instructions

### Prerequisites
- Node.js 16.9.0 or higher
- pnpm (recommended) or npm
- A Discord bot token
- A Discord server with admin permissions

### Installation
1. Clone the repository
```bash
git clone https://github.com/q4ow/snustalk.git
cd snustalk-bot
```

2. Install dependencies
```bash
pnpm install
```

3. Create a .env file based on the example below
4. Start the bot
```bash
pnpm start
```

For development:
```bash
pnpm dev
```

## Environment Variables

Create a .env file in the root directory with the following variables:

```env
DISCORD_TOKEN=                  # Your bot's token
GUILD_ID=                       # Your server ID
RESTORECORD_LINK=               # Your restorecord link (optional)
EZ_HOST_KEY=                    # API key for EZ.Host (for transcripts)
VERIFIED_ROLE_ID=               # Role ID for verified members
UNVERIFIED_ROLE_ID=             # Role ID for unverified members
MANAGEMENT_ROLE_ID=             # Role ID for management team
STAFF_ROLE_ID=                  # Role ID for staff members
TICKET_CATEGORY_ID=             # Category ID for tickets
WELCOME_CHANNEL_ID=             # Channel ID for welcome messages
VERIFICATION_CHANNEL_ID=        # Channel ID for verification
TICKET_LOGS_CHANNEL_ID=         # Channel ID for ticket logs
STATS_MEMBERS_CHANNEL_ID=       # Channel ID for member count
STATS_BOTS_CHANNEL_ID=          # Channel ID for bot count
STATS_TOTAL_TICKETS_CHANNEL_ID= # Channel ID for total tickets
STATS_OPEN_TICKETS_CHANNEL_ID=  # Channel ID for open tickets
```

### How to Get These Values

1. **Bot Token**: 
   - Create a new application at [Discord Developer Portal](https://discord.com/developers/applications)
   - Go to Bot section and create a bot
   - Copy the token

2. **IDs**:
   - Enable Developer Mode in Discord (User Settings > App Settings > Advanced)
   - Right-click channels/roles/server to copy IDs

## Server Setup

1. Create necessary channels:
   - Welcome channel
   - Verification channel
   - Ticket logs channel
   - Ticket category

2. Create required roles:
    - Verified
    - Unverified
    - Staff
    - Management

> **Note**: The names of these roles are just examples and can be customized to fit your server's needs. Ensure the role IDs are properly configured in the `.env` file.

3. Set up proper permissions:
   - Ensure the bot role is above all managed roles (Likely just the role given to verified users)
   - Configure channel permissions for verification and tickets

## Usage

### Bot Commands
Both slash commands and prefix commands are available:

#### Slash Commands
- `/setup-tickets` - Creates the ticket panel
- `/purge <amount>` - Deletes specified number of messages (1-100)
- `/resend-verify` - Resends verification embed (DEBUG)
- `/welcome` - Manually triggers welcome message (DEBUG)
- `/userinfo [user]` - Shows detailed information about a user
- `/serverinfo` - Shows information about the server
- `/lock [channel]` - Locks a channel from sending messages
- `/unlock [channel]` - Unlocks a previously locked channel
- `/nickname <user> <name>` - Changes a user's nickname
- `/ping` - Shows the bot's latency
- `/avatar [user]` - Shows user's avatar
- `/help` - Displays all commands and their usage
- `/warn <user> [reason]` - Warns a user
- `/removewarning <id>` - Removes a warning from a user
- `/kick <user> [reason]` - Kicks a user from the server
- `/ban <user> [reason] [delete_days]` - Bans a user from the server
- `/timeout <user> <duration> [reason]` - Timeouts a user
- `/untimeout <user> [reason]` - Removes timeout from a user
- `/warnings <user>` - Views warnings for a user
- `/modlogs <user>` - Views moderation history for a user

#### Prefix Commands
All slash commands are also available as prefix commands using `$`:
- `$setup-tickets` - Creates the ticket panel
- `$purge <number>` - Deletes specified number of messages
- `$resend-verify` - Resends verification embed (DEBUG)
- `$welcome` - Manually triggers welcome message (DEBUG)
- `$userinfo [@user]` - Shows detailed information about a user
- `$serverinfo` - Shows information about the server
- `$lock [#channel]` - Locks a channel from sending messages
- `$unlock [#channel]` - Unlocks a previously locked channel
- `$nickname @user <name>` - Changes a user's nickname
- `$ping` - Shows the bot's latency
- `$avatar [@user]` - Shows user's avatar
- `$help` - Displays all commands and their usage
- `$warn @user [reason]` - Warns a user
- `$removewarning <id>` - Removes a warning from a user
- `$kick @user [reason]` - Kicks a user from the server
- `$ban @user [reason] [delete_days]` - Bans a user from the server
- `$timeout @user <duration> [reason]` - Timeouts a user
- `$untimeout @user [reason]` - Removes timeout from a user
- `$warnings @user` - Views warnings for a user
- `$modlogs @user` - Views moderation history for a user

> **Note**: 
> - `<>` indicates required parameters
> - `[]` indicates optional parameters
> - Duration format for timeout: `1m`, `1h`, `1d` (minutes, hours, days)
> - All moderation commands require appropriate permissions

### Verification Process
1. Users join the server
2. They automatically receive the unverified role
3. They must react to the verification message
4. Upon verification, they receive the verified role

### Ticket System
- Users can create tickets from the ticket panel
- Two types available: General and Management
- Staff members are automatically notified
- Transcripts are saved when tickets are closed

## Roadmap

### Goals
- [ ] Add more moderation commands
- [ ] Implement logging system
- [ ] Add custom commands feature
- [ ] Implement auto-moderation features
- [ ] Add user information tracking system
- [ ] Create server statistics dashboard
- [ ] Enhance ticket system with priority levels
- [ ] Add multilingual support for commands and messages
- [ ] Integrate third-party APIs for extended functionality

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

For issues, suggestions, or contributions, please open an issue or pull request on GitHub.