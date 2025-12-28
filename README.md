# Discord RPC for Greenlight

This fork adds Discord Rich Presence support to Greenlight. When you are streaming from your console or xCloud, your Discord status will update to show what you are playing.

## How to make it work

To use your own Discord Application ID:

1. Open `packages/desktop/main/helpers/discord.ts`.
2. Find the line:
   ```typescript
   private _clientId: string = '' // Replace with your Discord Client ID
   ```
3. Replace the empty string with your **Discord Client ID** from the [Discord Developer Portal](https://discord.com/developers/applications).
4. Build and run the application.

## Credits

Original project: [Greenlight](https://github.com/unknownskl/greenlight)