export const MOD_ACTIONS = {
    WARN: "warn",
    KICK: "kick",
    BAN: "ban",
    TIMEOUT: "timeout",
    REMOVE_TIMEOUT: "untimeout",
};

export function getActionColor(type) {
    const colors = {
        [MOD_ACTIONS.WARN]: "#FFA500",
        [MOD_ACTIONS.KICK]: "#FF7F50",
        [MOD_ACTIONS.BAN]: "#FF0000",
        [MOD_ACTIONS.TIMEOUT]: "#FFD700",
        [MOD_ACTIONS.REMOVE_TIMEOUT]: "#32CD32",
    };
    return colors[type] || "#2F3136";
}

export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day(s)`;
    if (hours > 0) return `${hours} hour(s)`;
    if (minutes > 0) return `${minutes} minute(s)`;
    return `${seconds} second(s)`;
}