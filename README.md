# SnusTalk Central Bot

A Discord bot built with discord.js, originally developed for the SnusTalk Central server but available for anyone to use and modify under the MIT license.

## Features

### Currently Implemented
- **Verification System**
  - Reaction-based verification
  - Automatic role assignment

- **Welcome System**
  - Customizable welcome messages
  - Member count tracking
  - Automatic unverified role assignment

- **Ticket System**
  - Two-tier support system (General & Management)
  - Transcript logging
  - Automatic category and permission management
  - Staff role notifications

- **Moderation**
  - Message purging command
  - More features planned

### Planned Features
- Moderation commands
- Server statistics
- Basic auto-moderation (e.g., word filtering)
- Lightweight logging system (e.g., message deletions, user joins/leaves)
- User note tracking
- Custom command creation with limited scope

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
DISCORD_TOKEN=           # Your bot's token
GUILD_ID=                # Your server ID
WELCOME_CHANNEL_ID=      # Channel ID for welcome messages
VERIFICATION_CHANNEL_ID= # Channel ID for verification
VERIFIED_ROLE_ID=        # Role ID for verified members
UNVERIFIED_ROLE_ID=      # Role ID for unverified members
TICKET_CATEGORY_ID=      # Category ID for tickets
MANAGEMENT_ROLE_ID=      # Role ID for management team
STAFF_ROLE_ID=           # Role ID for staff members
TICKET_LOGS_CHANNEL_ID=  # Channel ID for ticket logs
EZ_HOST_KEY=             # API key for EZ.Host (for transcripts)
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
- `$setup-tickets` - Creates the ticket panel
- `$purge <number>` - Deletes specified number of messages

### Debug Commands
- `$resend-verify` - Resends verification embed
- `$welcome` - Manually triggers welcome message

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