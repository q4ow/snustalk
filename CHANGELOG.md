# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.5] - 2025-04-27

### Added
- Enhanced Moderation System
  - Added persistent mod action logging in database
  - Added rate limiting (10 actions per 5 minutes per moderator)
  - Added appeal system for bans and long timeouts
  - Added acknowledgment requirement for serious actions
  - Added bulk moderation action support
  - Added active timeout tracking
  - Added enhanced DM notifications with appeal info

### Fixed
- Fixed mod_actions table initialization
- Fixed unique constraint syntax in mod_actions table
- Fixed MOD_ACTIONS import in database.js
- Fixed rate limiting implementation for moderation actions

### Changed
- Enhanced moderation action tracking with detailed logging
- Improved moderation DM notifications with more context
- Added appeal workflow for serious actions
- Enhanced bulk action support for multiple users

## [1.2.4] - 2025-04-24

### Added
- Database Operations
  - Added comprehensive error handling for PostgreSQL error codes
  - Implemented connection pool monitoring with automatic recovery
  - Added database health checks in regular intervals
  - Added metrics tracking for database performance
  - Added slow query detection and logging

- Settings System
  - Implemented caching system for guild settings with 5-minute TTL
  - Added cache invalidation on settings updates
  - Added helper functions for cache management
  - Improved error handling with detailed error embeds

- Bot Framework
  - Added memory optimization with cache limits and sweepers
  - Implemented metrics collection for commands, errors, messages, and interactions
  - Added graceful shutdown handling for SIGTERM and SIGINT signals
  - Added comprehensive error tracking system

### Changed
- Database Connection Pool
  - Increased max connections from 20 to 30
  - Improved connection timeout settings
  - Added statement timeout to prevent hanging queries
  - Implemented exponential backoff for deadlock retries
  - Enhanced query logging for better debugging

- Settings Handler
  - Completely refactored with cleaner code organization
  - Improved error handling with consistent error embeds
  - Enhanced display formatting for different setting types
  - Added better validation for setting values

- Bot Constructor
  - Optimized Discord.js client options for better performance
  - Added cache limits and sweepers to reduce memory usage
  - Improved presence update handling
  - Added reconnection mechanism for disconnected services

### Fixed
- Prevented database resource exhaustion during high load
- Fixed potential memory leaks in database client checkout
- Improved error recovery in database operations
- Enhanced error reporting in interactions and commands

## [1.2.3] - 2025-04-24

### Fixed
- Application handler
  - Fixed modal submission handling for application acceptance/denial
  - Added dedicated handler for application modals in main interaction handler
  - Fixed interaction timing out when accepting/denying applications
  - Improved error handling for modal submissions

## [1.2.2] - 2025-04-24

### Changed
- Application handler
  - Refactored application handler to follow modular structure
  - Created separate commands.js and handler.js files in application directory
  - Improved code organization and maintainability
  - Maintained backward compatibility through re-exports
  - Fixed timeout issues when accepting or denying moderator applications
  - Added enhanced error handling for user/member fetching operations
  - Improved handling of role assignment failures
  - Added detailed logging for easier debugging
- Automod handler
  - Simplified automodHandler.js to use re-exports only
  - Ensured consistent handler structure across features

### Fixed
- Application handler
  - Fixed error in apply command with channel permission checking
  - Added validation for channel types to prevent "permissionsFor is not a function" error
  - Updated channel validation to use database-stored channel IDs instead of environment variables
  - Fixed "permissionsFor is not a function" error when accessing application channels
  - Added proper error messages when application channel is not configured
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
