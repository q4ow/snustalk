# SnusTalk Central Bot

A Discord bot built with discord.js, originally developed for the SnusTalk Central server but available for anyone to use and modify under the MIT license.

## I AM ONLY HUMAN
I maintain this project in my spare time. I am 16 and my exams are next month, this bot **WILL NOT** get frequent, meaningful updates.
Although I don't ever plan to abandon this, I make no promises. The project will always be MIT licensed, you will forever have the right
to copy, edit, redistribute and use this code in any commercial or non-commercial manner. Show some love with a star if it's interesting
and maybe fork it if you're feeling adventurous. I'm open to pull requests, issues, feature requests and more. If you do something cool
with my code, I'd love to see it so drop me an email or add me on [Discord](https://discord.com/users/1230319937155760131).

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
  - Auto-close functionality
  - Customizable ticket settings

- **Server Statistics**
  - Member count tracking
  - Bot count tracking
  - Total tickets tracking
  - Open tickets tracking

- **Automod System**
  - Configurable message filters
  - Spam detection and prevention
  - Mass mention protection
  - Excessive caps filtering
  - Link control with whitelisting
  - Discord invite blocking
  - Word/phrase blacklisting
  - Configurable actions (delete/warn/timeout)
  - Role and channel exemptions
  - Detailed violation logging
  - Per-filter settings

- **Moderation**
  - Message purging command
  - Channel lock/unlock
  - Nickname management
  - Warning system with removal
  - Kick and ban commands
  - Timeout management
  - Moderation history tracking
  - Role hierarchy checks
  - Action logging
  - Permission-based access

- **Logging System**
  - Member events (joins, leaves, nickname changes)
  - Message events (edits, deletions, bulk deletions)
  - Moderation actions
  - Voice channel events
  - Channel events (create, delete, update)
  - Role events
  - Server events
  - User updates
  - Invite tracking
  - Thread monitoring
  - Customizable logging channels
  - Channel blacklisting

- **Staff Applications**
  - Multi-step application process
  - DM-based questionnaire
  - Staff review system
  - Automatic role assignment
  - Application logging

- **Utility Commands**
  - User information
  - Server information
  - Avatar display
  - Bot latency check
  - Custom embed creation

## Setup Instructions

### Prerequisites
- Node.js 16.9.0 or higher
- pnpm (recommended) or npm
- postgresql
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
# Bot and Server Configuration
DISCORD_TOKEN=                   # Your bot's token
GUILD_ID=                        # Your server ID
EZ_HOST_KEY=                     # API key for EZ.Host (for transcripts)
RESTORECORD_LINK=               # Your restorecord link (optional)

# Channel IDs
WELCOME_CHANNEL_ID=             # Channel ID for welcome messages
VERIFICATION_CHANNEL_ID=        # Channel ID for verification
APPLICATIONS_CHANNEL_ID=        # Channel ID for staff applications
APPLICATIONS_LOGS_CHANNEL_ID=   # Channel ID for application logs
TICKET_CATEGORY_ID=             # Category ID for tickets

# Role IDs
VERIFIED_ROLE_ID=               # Role ID for verified members
UNVERIFIED_ROLE_ID=             # Role ID for unverified members
MANAGEMENT_ROLE_ID=             # Role ID for management team
STAFF_APPLICANT_ROLE_IDS=       # Comma-separated role IDs for staff applicants
MODERATOR_ROLE_ID=              # Role ID for moderators
STAFF_ROLE_ID=                  # Role ID for staff members
MUTED_ROLE_ID=                  # Role ID for muted members

# Logging Channel IDs
TICKET_LOGS_CHANNEL_ID=         # Channel ID for ticket logs
MEMBER_LOGS_CHANNEL_ID=         # Channel ID for member events (joins, leaves, etc)
MESSAGE_LOGS_CHANNEL_ID=        # Channel ID for message events
MOD_LOGS_CHANNEL_ID=            # Channel ID for moderation actions
VOICE_LOGS_CHANNEL_ID=          # Channel ID for voice channel events
CHANNEL_LOGS_CHANNEL_ID=        # Channel ID for channel events
ROLE_LOGS_CHANNEL_ID=           # Channel ID for role changes
SERVER_LOGS_CHANNEL_ID=         # Channel ID for server-wide changes
USER_LOGS_CHANNEL_ID=           # Channel ID for user updates
INVITE_LOGS_CHANNEL_ID=         # Channel ID for invite tracking
THREAD_LOGS_CHANNEL_ID=         # Channel ID for thread events

# Statistics Channel IDs
STATS_MEMBERS_CHANNEL_ID=       # Channel ID for member count
STATS_BOTS_CHANNEL_ID=          # Channel ID for bot count
STATS_TOTAL_TICKETS_CHANNEL_ID= # Channel ID for total tickets
STATS_OPEN_TICKETS_CHANNEL_ID=  # Channel ID for open tickets

# Database Configuration
DB_USER=                        # Database username
DB_HOST=                        # Database host
DB_NAME=                        # Database name
DB_PASSWORD=                    # Database password
DB_PORT=                        # Database port

# Session Configuration
SESSION_SECRET=                 # Secret for session management
```

## Server Setup

1. Create necessary channels:
   - Welcome channel
   - Verification channel
   - Ticket logs channel
   - Ticket category
   - Other logs channels

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
- `/automod toggle <enabled>` - Enable or disable the automod system
- `/automod logchannel <channel>` - Set the channel for automod logs
- `/automod exempt <type> <target>` - Add/remove role/channel exemptions
- `/automod filter <type> <action> <enabled> [settings]` - Configure automod filters

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
- `$automod toggle <enabled>` - Enable or disable the automod system
- `$automod logchannel <channel>` - Set the channel for automod logs
- `$automod exempt <type> <target>` - Add/remove role/channel exemptions
- `$automod filter <type> <action> <enabled> [settings]` - Configure automod filters

> **Note**: 
> - `<>` indicates required parameters
> - `[]` indicates optional parameters
> - Duration format for timeout: `1m`, `1h`, `1d` (minutes, hours, days)
> - All moderation commands require appropriate permissions
> - Filter types: spam, invites, mentions, caps, links, words
> - Filter actions: delete, warn, timeout
> - Filter settings can be provided in JSON format for advanced configuration

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

### Automod System
1. Enable/disable the system:
   `/automod toggle enabled:true`

2. Configure log channel:
   `/automod logchannel #channel`

3. Set up filters:
   - Spam: `/automod filter type:spam action:timeout enabled:true settings:{"maxMessages":5,"timeWindow":5000}`
   - Mentions: `/automod filter type:mentions action:warn enabled:true settings:{"maxMentions":3}`
   - Caps: `/automod filter type:caps action:delete enabled:true settings:{"percentage":70,"minLength":10}`
   - Links: `/automod filter type:links action:delete enabled:true settings:{"whitelist":["discord.com","github.com"]}`
   - Words: `/automod filter type:words action:delete enabled:true settings:{"blacklist":["badword1","badword2"]}`

4. Add exemptions:
   - Roles: `/automod exempt type:add_role target:ROLE_ID`
   - Channels: `/automod exempt type:add_channel target:CHANNEL_ID`

> **Note**: All automod commands require the Manage Server permission.

## Roadmap

### Goals
- [x] Implement logging system
- [x] Implement auto-moderation features
- [ ] Add more moderation commands
- [ ] Add custom commands feature
- [ ] Add user information tracking system
- [ ] Create server statistics dashboard
- [ ] Enhance ticket system with priority levels
- [ ] Add multilingual support for commands and messages
- [ ] Integrate third-party APIs for extended functionality

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

For issues, suggestions, or contributions, please open an issue or pull request on GitHub.