# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2025-04-24

### Changed
- Application handler
  - Refactored application handler to follow modular structure
  - Created separate commands.js and handler.js files in application directory
  - Improved code organization and maintainability
  - Maintained backward compatibility through re-exports
- Automod handler
  - Simplified automodHandler.js to use re-exports only
  - Ensured consistent handler structure across features

### Fixed
- Application handler
  - Fixed error in apply command with channel permission checking
  - Added validation for channel types to prevent "permissionsFor is not a function" error
- Command registration
  - Fixed duplicate command registration of "apply" command
  - Added automatic detection and removal of duplicate command definitions

## [1.2.1] - 2025-04-24

### Changed
- Refactored the settings handler and associated commands for improved structure and maintainability.
- Enhanced the robustness of the role settings configuration process.

### Fixed
- Removed redundant variable declarations within the settings handler.
- Corrected issues within the settings system implementation.

## [1.2.0] - 2025-04-18

### Added
- Anti-Raid System
  - Management via commands
  - Customizable cooldown period for new members
  - Temporary bans for suspicious activity
  - Detailed logging of anti-raid actions
  - Role-based access control for anti-raid settings
  - Much more
- Comprehensive logging system for raid incidents and server boosts
- Detailed logging for all anti-raid actions including:
  - Raid detection events
  - Server lockdown status
  - Suspicious member detection
  - Similar username detection
- Server boost tracking with detailed metrics
  - Boost start and end events
  - Duration tracking
  - Server boost level changes

### Fixed
- Fixed serialization issues with BigInt permission flags in slash commands
- Converted all permission flags to strings in slash commands and anti-raid commands
- Improved error handling for invalid permission values

### Changed
- Updated permission handling in command registration
- Added explicit string conversion for defaultMemberPermissions values
- Enhanced raid protection with integrated logging
- Improved server boost tracking and notifications

## [1.1.0] - 2025-04-17

### Added
- Giveaway System
  - Create customizable giveaways with requirements
  - Multiple winner support
  - Role requirements and account age restrictions
  - Button-based entry system
  - Rerolling and blacklist functionality
  - Entry tracking and customizable end messages

- Typing Game Integration
  - Built-in typing speed game with web interface
  - WPM tracking and leaderboards
  - Personal best score tracking
  - Real-time score updates

- API System
  - RESTful API for bot interaction
  - User-specific API key generation
  - Secure authentication system
  - Dashboard integration capabilities
  - Session management
  - Database integration

- New Commands
  - `/giveaway` suite of commands for managing giveaways
  - `/typingscore` to view personal typing speed
  - `/typingleaderboard` for typing competition rankings
  - `/typinggame` to access the typing game
  - `/dashboard` for API key management
  - `/embed` for creating custom embed messages

### Changed
- Enhanced error handling across all commands
- Improved health check system with detailed monitoring
- Updated initialization process for better reliability
- Enhanced database interaction efficiency
- Expanded environment variable configuration options

### Fixed
- Various command permission checks
- Role hierarchy validation in moderation commands
- Command response consistency
- Error message clarity and helpfulness
- Database connection stability

## [1.0.0] - Initial Release

### Added
- Initial release of Snussy bot
- Basic moderation features
- Ticketing system
- Verification system
- Auto-moderation
- Anti-raid protection
- Giveaway system
- Server stats tracking
- Customizable logging
- Role management
- API integration
- Initial bot implementation with core features:
  - Verification System
  - Welcome System
  - Ticket System
  - Server Statistics
  - Automod System
  - Moderation Commands
  - Logging System
  - Staff Applications
  - Utility Commands
