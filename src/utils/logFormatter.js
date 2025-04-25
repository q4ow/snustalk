export class LogFormatter {
    constructor(options = {}) {
        this.options = {
            format: process.env.LOG_FORMAT || 'text',
            includeTimestamp: true,
            includePid: true,
            ...options
        };
    }

    format(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const pid = process.pid;

        if (this.options.format === 'json') {
            return JSON.stringify({
                timestamp,
                level,
                message,
                pid,
                ...data,
                env: process.env.NODE_ENV || 'development'
            });
        }

        let formattedMessage = '';

        if (this.options.includeTimestamp) {
            formattedMessage += `[${timestamp}] `;
        }

        if (this.options.includePid) {
            formattedMessage += `[${pid}] `;
        }

        formattedMessage += `${level} ${message}`;

        if (Object.keys(data).length > 0) {
            const formatValue = (value) => {
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value, null, 2).replace(/\n/g, '\n  ');
                }
                return value;
            };

            const dataString = Object.entries(data)
                .map(([key, value]) => `\n  ${key}: ${formatValue(value)}`)
                .join('');

            formattedMessage += dataString;
        }

        return formattedMessage;
    }

    static sanitize(data, sensitiveFields = ['password', 'token', 'secret']) {
        const sanitized = { ...data };

        const sanitizeObject = (obj) => {
            if (typeof obj !== 'object' || obj === null) return obj;

            const sanitizedObj = Array.isArray(obj) ? [...obj] : { ...obj };

            for (const [key, value] of Object.entries(sanitizedObj)) {
                if (sensitiveFields.includes(key.toLowerCase())) {
                    sanitizedObj[key] = '********';
                } else if (typeof value === 'object') {
                    sanitizedObj[key] = sanitizeObject(value);
                }
            }

            return sanitizedObj;
        };

        return sanitizeObject(sanitized);
    }

    static truncate(data, maxLength = 1000) {
        const truncateValue = (value) => {
            if (typeof value === 'string' && value.length > maxLength) {
                return value.substring(0, maxLength) + '...';
            }
            return value;
        };

        const truncateObject = (obj) => {
            if (typeof obj !== 'object' || obj === null) return truncateValue(obj);

            const truncatedObj = Array.isArray(obj) ? [] : {};

            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object') {
                    truncatedObj[key] = truncateObject(value);
                } else {
                    truncatedObj[key] = truncateValue(value);
                }
            }

            return truncatedObj;
        };

        return truncateObject(data);
    }
}