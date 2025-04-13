import { EmbedBuilder } from "discord.js";

export function createNotesEmbed(notes) {
    return new EmbedBuilder()
        .setTitle("Your Notes")
        .setColor("#2F3136")
        .setDescription(
            notes
                .map(
                    (note) =>
                        `**ID:** ${note.id}\n${note.content}\n*Created: <t:${Math.floor(new Date(note.timestamp).getTime() / 1000)}:R>*${note.edited ? `\n*Edited: <t:${Math.floor(new Date(note.edited).getTime() / 1000)}:R>*` : ""}\n`,
                )
                .join("\n"),
        );
}