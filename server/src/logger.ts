import fs from 'fs';
import path from 'path';
import winston from 'winston';
import moment from 'moment';

const logDir = '/persistent/free-sleep-data/logs';
const logFile = path.join(logDir, 'free-sleep.log');
const isDev = process.env.MODE === 'dev' || process.env.NODE_ENV === 'development';

// Try to create directory, or fall back to console only
let fileTransport;
try {
  fs.mkdirSync(logDir, { recursive: true });
  fs.accessSync(logDir, fs.constants.W_OK);
  fileTransport = new winston.transports.File({
    filename: logFile,
    maxsize: 7 * 1024 * 1024,
    maxFiles: 1,
    tailable: true,
  });
} catch (error) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';
  const message = `Logger cannot write to ${logDir}, file logging disabled: ${errorMessage}`;
  console.warn(message);
}


// Console transport: pretty in dev (colorised, human-readable), JSON in prod
// (structured, parseable). The file transport always uses JSON so log
// shipping/grep tools see consistent output.
const prettyConsole = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} | ${level.padStart(15)} | ${message}`;
    })
  ),
});

const jsonConsole = new winston.transports.Console({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
});

const transports: Array<winston.transports.ConsoleTransportInstance | winston.transports.FileTransportInstance> = [
  isDev ? prettyConsole : jsonConsole,
];

if (fileTransport) {
  // The file transport reuses the logger's base format; we set the base
  // format to JSON below so file lines are always structured.
  transports.push(fileTransport);
}

const baseFormat = isDev
  ? winston.format.combine(
    winston.format.timestamp({
      format: () => moment.utc().format('YYYY-MM-DD HH:mm:ss [UTC]'),
    }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} | ${level.padStart(8)} | ${message}`;
    })
  )
  : winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

const logger = winston.createLogger({
  // 'debug' fills /persistent/free-sleep-data/logs/free-sleep.log fast on a
  // pod with limited disk. Default to 'info' in production; allow override
  // via LOG_LEVEL for one-off debugging without redeploying.
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: baseFormat,
  transports,
});

export default logger;
