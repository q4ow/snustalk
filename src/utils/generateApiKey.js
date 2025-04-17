import { db } from './database.js';

export async function generateApiKey(userId) {
    try {
        // First ensure the user exists in the database
        await db.ensureUser(userId);

        // Generate and save API key using the database method
        const apiKey = await db.generateApiKey(userId);

        if (!apiKey) {
            throw new Error('Failed to save API key');
        }

        return { success: true, key: apiKey };
    } catch (error) {
        console.error('Error generating API key:', error);
        // Check if user already has an API key
        try {
            const existingKey = await db.getApiKeyByUserId(userId);
            if (existingKey) {
                return { success: false, key: existingKey };
            }
        } catch (err) {
            console.error('Error checking existing API key:', err);
        }
        return { success: false, error: 'Failed to generate API key' };
    }
}