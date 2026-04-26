import { SequentialQueue } from './sequentialQueue.js';
import { MessageStream } from './messageStream.js';
import { frankenCommands } from './deviceApi.js';
import { UnixSocketServer } from './unixSocketServer.js';
import logger from '../logger.js';
import { loadDeviceStatus } from './loadDeviceStatus.js';
import config from '../config.js';
import { toPromise, wait } from './promises.js';
import { promiseWithTimeout } from './timeoutPromise.js';
import metrics from '../metrics/metrics.js';
const FRANKEN_CONNECTION_TIMEOUT_MS = 25_000;
const FRANKEN_COMMAND_TIMEOUT_MS = Number(process.env.FRANKEN_COMMAND_TIMEOUT_MS) || 5_000;
class FrankenConnectionTimeoutError extends Error {
    constructor() {
        super('Timed out waiting for Franken hardware connection');
        this.name = 'FrankenConnectionTimeoutError';
    }
}
export class FrankenCommandTimeoutError extends Error {
    constructor(commandNumber, timeoutMs) {
        super(`Franken command ${commandNumber} did not respond within ${timeoutMs}ms`);
        this.name = 'FrankenCommandTimeoutError';
    }
}
export class Franken {
    socket;
    messageStream;
    sequentialQueue;
    static responseDelayMs = 10;
    constructor(socket, messageStream, sequentialQueue) {
        this.socket = socket;
        this.messageStream = messageStream;
        this.sequentialQueue = sequentialQueue;
    }
    static separator = Buffer.from('\n\n');
    async sendMessage(message) {
        logger.debug(`Sending message to sock | message: ${message}`);
        const commandNumber = message.split('\n', 1)[0] ?? '?';
        const startedAt = Date.now();
        let timedOut = false;
        try {
            const responseBytes = await this.sequentialQueue.exec(async () => {
                const requestBytes = Buffer.concat([Buffer.from(message), Franken.separator]);
                await this.write(requestBytes);
                // Race the read against a per-command timeout. If the timeout fires
                // we abort the readMessage() listener (so it stops holding a slot in
                // the message stream) and surface a typed error.
                const abortController = new AbortController();
                const resp = await promiseWithTimeout(this.messageStream.readMessage({ signal: abortController.signal }), FRANKEN_COMMAND_TIMEOUT_MS, {
                    abortController,
                    onTimeout: () => new FrankenCommandTimeoutError(commandNumber, FRANKEN_COMMAND_TIMEOUT_MS),
                });
                if (Franken.responseDelayMs > 0) {
                    await wait(10);
                }
                return resp;
            });
            metrics.recordFrankenCommand(Date.now() - startedAt, false);
            const response = responseBytes.toString();
            logger.debug(`Message sent successfully to sock | message: ${message}`);
            return response;
        }
        catch (error) {
            if (error instanceof FrankenCommandTimeoutError) {
                timedOut = true;
                metrics.recordFrankenCommand(Date.now() - startedAt, true);
                logger.warn(`${error.message}; tearing down dac.sock so the next call reconnects`);
                // Fire-and-forget the reconnect so the rejected caller can handle the
                // error promptly. The next caller will rebuild the connection.
                // eslint-disable-next-line no-use-before-define
                void disconnectFranken().catch(err => logger.error(`disconnect after timeout failed: ${err}`));
            }
            if (!timedOut) {
                metrics.recordFrankenCommand(Date.now() - startedAt, false);
            }
            throw error;
        }
    }
    tryStripNewlines(arg) {
        const containsNewline = arg.indexOf('\n') >= 0;
        if (!containsNewline)
            return arg;
        return arg.replace(/\n/gm, '');
    }
    async callFunction(command, arg) {
        logger.debug(`Calling function | command: ${command} | arg: ${arg}`);
        const commandNumber = frankenCommands[command];
        const cleanedArg = this.tryStripNewlines(arg);
        logger.debug(`commandNumber: ${commandNumber}`);
        logger.debug(`cleanedArg: ${cleanedArg}`);
        await this.sendMessage(`${commandNumber}\n${cleanedArg}`);
    }
    async getDeviceStatus(getGestures = false) {
        const command = 'DEVICE_STATUS';
        const commandNumber = frankenCommands[command];
        const response = await this.sendMessage(commandNumber);
        return await loadDeviceStatus(response, getGestures);
    }
    close() {
        const socket = this.socket;
        if (!socket.destroyed)
            socket.destroy();
    }
    static fromSocket(socket) {
        const messageStream = new MessageStream(socket, Franken.separator);
        return new Franken(socket, messageStream, new SequentialQueue());
    }
    async write(data) {
        // @ts-expect-error
        await toPromise(cb => this.socket.write(data, cb));
    }
}
class FrankenServer {
    server;
    constructor(server) {
        this.server = server;
    }
    async close() {
        logger.debug('Closing FrankenServer socket...');
        await this.server.close();
    }
    async waitForFranken() {
        const socket = await this.server.waitForConnection();
        logger.debug('FrankenServer connected');
        return Franken.fromSocket(socket);
    }
    static async start(path) {
        logger.debug(`Creating franken server on socket: ${config.dacSockPath}`);
        const unixSocketServer = await UnixSocketServer.start(path);
        return new FrankenServer(unixSocketServer);
    }
}
let frankenServer;
let franken;
let connectPromise;
function waitForFrankenWithTimeout(server) {
    if (!FRANKEN_CONNECTION_TIMEOUT_MS) {
        return server.waitForFranken();
    }
    const timeoutMessage = `Restarting Franken after ${FRANKEN_CONNECTION_TIMEOUT_MS / 1_000}s timeout`;
    return promiseWithTimeout(server.waitForFranken(), FRANKEN_CONNECTION_TIMEOUT_MS, {
        onTimeout: () => {
            logger.warn(timeoutMessage);
            return new FrankenConnectionTimeoutError();
        },
    });
}
async function shutdownFrankenServer() {
    if (franken) {
        try {
            await franken.sequentialQueue.drain();
        }
        catch {
            // ignored
        }
        franken.close();
        franken = undefined;
    }
    if (frankenServer) {
        await frankenServer.close();
        frankenServer = undefined;
    }
}
export async function connectFranken() {
    if (franken)
        return franken;
    if (connectPromise)
        return connectPromise;
    connectPromise = (async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (!frankenServer) {
                frankenServer = await FrankenServer.start(config.dacSockPath);
                logger.debug('FrankenServer started');
            }
            try {
                logger.debug('Waiting for Franken hardware connection...');
                franken = await waitForFrankenWithTimeout(frankenServer);
                logger.info('Franken socket connected');
                return franken;
            }
            catch (error) {
                if (error instanceof FrankenConnectionTimeoutError) {
                    logger.warn('Unable to connect to Franken within timeout, restarting socket server...');
                    await shutdownFrankenServer();
                    continue;
                }
                await shutdownFrankenServer();
                throw error;
            }
        }
    })();
    try {
        return await connectPromise;
    }
    finally {
        connectPromise = undefined;
    }
}
export async function disconnectFranken() {
    connectPromise = undefined;
    await shutdownFrankenServer();
}
export function getFrankenQueueDepth() {
    return franken?.sequentialQueue.depth() ?? 0;
}
// Concurrent callers asking for device status share a single roundtrip while
// one is in flight. Cache lifetime is the duration of the in-flight call only —
// no stale reads, this is purely a "did N requests just arrive simultaneously"
// optimisation. Failures (including timeouts) are not cached.
let inFlightDeviceStatus;
export async function getDeviceStatusCoalesced(getGestures = false) {
    if (inFlightDeviceStatus)
        return inFlightDeviceStatus;
    const f = await connectFranken();
    inFlightDeviceStatus = f.getDeviceStatus(getGestures).finally(() => {
        inFlightDeviceStatus = undefined;
    });
    return inFlightDeviceStatus;
}
//# sourceMappingURL=frankenServer.js.map