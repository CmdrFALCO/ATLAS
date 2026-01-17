export type ScenarioEventCallback = (data: any) => void;

/**
 * Simple Pub/Sub system for managing scripted demo events.
 * Allows modules to decouple from the core logic triggering them.
 */
export class ScenarioRunner {
    private listeners: Map<string, ScenarioEventCallback[]> = new Map();

    /**
     * Subscribe to an event topic.
     */
    on(topic: string, callback: ScenarioEventCallback): void {
        if (!this.listeners.has(topic)) {
            this.listeners.set(topic, []);
        }
        this.listeners.get(topic)?.push(callback);
    }

    /**
     * Unsubscribe from an event topic.
     */
    off(topic: string, callback: ScenarioEventCallback): void {
        const callbacks = this.listeners.get(topic);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Publish an event to all subscribers.
     */
    emit(topic: string, data?: any): void {
        // console.log(`[ScenarioRunner] Event: ${topic}`, data);
        const callbacks = this.listeners.get(topic);
        if (callbacks) {
            callbacks.forEach(cb => cb(data));
        }
    }

    /**
     * Clear all listeners (useful directly before switching modules).
     */
    clear(): void {
        this.listeners.clear();
    }
}
