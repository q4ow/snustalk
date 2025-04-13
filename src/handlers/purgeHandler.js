export async function handlePurge(message, args) {
    try {
        const deleteCount = parseInt(args[0], 10);
        if (isNaN(deleteCount)) {
            return message.reply('❌ Please provide a valid number of messages to delete.').then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
        }

        if (deleteCount < 1 || deleteCount > 100) {
            return message.reply('❌ Please provide a number between 1 and 100.').then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
        }

        const fetchedMessages = await message.channel.messages.fetch({ limit: deleteCount });
        await message.channel.bulkDelete(fetchedMessages, true);
    } catch (error) {
        if (error.code === 50034) {
            return message.reply('❌ Cannot delete messages older than 14 days.').then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
        }

        console.error('Error in handlePurge:', error);
        return message.reply('❌ An unexpected error occurred while trying to delete messages.').then(msg => setTimeout(() => msg.delete().catch(() => { }), 5000));
    }
}