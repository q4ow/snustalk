import { db } from '../utils/database.js';

const NOTE_LIMITS = {
    MAX_NOTES: 10,
    MIN_LENGTH: 3,
    MAX_LENGTH: 500
};

export async function addNote(userId, content) {
    if (!content || content.length < NOTE_LIMITS.MIN_LENGTH) {
        throw new Error(`Note must be at least ${NOTE_LIMITS.MIN_LENGTH} characters long.`);
    }
    if (content.length > NOTE_LIMITS.MAX_LENGTH) {
        throw new Error(`Note cannot exceed ${NOTE_LIMITS.MAX_LENGTH} characters.`);
    }

    const notes = await db.getUserNotes(userId);
    if (notes.length >= NOTE_LIMITS.MAX_NOTES) {
        throw new Error(`You cannot have more than ${NOTE_LIMITS.MAX_NOTES} notes.`);
    }

    const noteId = Date.now().toString();
    await db.addUserNote(userId, { id: noteId, content, timestamp: new Date().toISOString() });
    return noteId;
}

export async function deleteNote(userId, noteId) {
    const deleted = await db.deleteUserNote(userId, noteId);
    if (!deleted) {
        throw new Error('Note not found or you do not have permission to delete it.');
    }
    return true;
}

export async function editNote(userId, noteId, newContent) {
    if (!newContent || newContent.length < NOTE_LIMITS.MIN_LENGTH) {
        throw new Error(`Note must be at least ${NOTE_LIMITS.MIN_LENGTH} characters long.`);
    }
    if (newContent.length > NOTE_LIMITS.MAX_LENGTH) {
        throw new Error(`Note cannot exceed ${NOTE_LIMITS.MAX_LENGTH} characters.`);
    }

    const edited = await db.editUserNote(userId, noteId, newContent);
    if (!edited) {
        throw new Error('Note not found or you do not have permission to edit it.');
    }
    return true;
}

export async function listNotes(userId) {
    const notes = await db.getUserNotes(userId);
    if (!notes || notes.length === 0) {
        throw new Error('You don\'t have any notes.');
    }
    return notes;
}