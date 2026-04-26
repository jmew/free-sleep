import { EventEmitter } from 'events';
class EventBus {
    // eslint-disable-next-line no-use-before-define
    static instance;
    emitter = new EventEmitter();
    clients = 0;
    static getInstance() {
        if (!EventBus.instance)
            EventBus.instance = new EventBus();
        return EventBus.instance;
    }
    constructor() {
        this.emitter.setMaxListeners(0);
    }
    emit(channel, payload) {
        const env = { channel, payload, ts: new Date().toISOString() };
        this.emitter.emit(channel, env);
        this.emitter.emit('*', env);
    }
    subscribe(channel, listener) {
        this.emitter.on(channel, listener);
        return () => this.emitter.off(channel, listener);
    }
    subscribeAll(listener) {
        this.emitter.on('*', listener);
        return () => this.emitter.off('*', listener);
    }
    registerClient() {
        this.clients += 1;
    }
    unregisterClient() {
        this.clients = Math.max(0, this.clients - 1);
    }
    get clientCount() {
        return this.clients;
    }
}
export default EventBus.getInstance();
//# sourceMappingURL=eventBus.js.map