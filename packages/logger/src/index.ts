import winston from "winston";

export type LogMeta = Record<string, unknown>;

export function createLogger(service: string) {
  const level = process.env.LOG_LEVEL ?? "info";

  return winston.createLogger({
    level,
    defaultMeta: { service },
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format:
          process.env.NODE_ENV === "production"
            ? winston.format.json()
            : winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level: lvl, message, timestamp, ...meta }) => {
                  const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
                  return `${timestamp} ${lvl}: ${message}${rest}`;
                })
              ),
      }),
    ],
  });
}

export type Logger = ReturnType<typeof createLogger>;
