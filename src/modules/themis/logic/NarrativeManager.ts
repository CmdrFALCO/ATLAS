
export type NarrativeEventType = 'SHOW_SUBTITLE' | 'WAIT' | 'SPAWN_AGENT' | 'LOGIC_CHECK';

export interface NarrativeEvent {
    type: NarrativeEventType;
    payload?: any; // Flexible for now
    blocking?: boolean; // If true, waits until complete before next event
}

export type NarrativeEventHandler = (event: NarrativeEvent) => Promise<void> | void;

export class NarrativeManager {
    private queue: NarrativeEvent[] = [];
    private currentEvent: NarrativeEvent | null = null;
    private waitTimer: number = 0;
    private handlers: Map<NarrativeEventType, NarrativeEventHandler> = new Map();
    private isBlocked: boolean = false;

    constructor() {
        // Default Wait Handler
        this.on('WAIT', (e) => {
            this.waitTimer = e.payload ? (e.payload as number) : 1;
            this.isBlocked = true;
        });
    }

    public on(type: NarrativeEventType, handler: NarrativeEventHandler) {
        this.handlers.set(type, handler);
    }

    public addEvent(event: NarrativeEvent) {
        this.queue.push(event);
    }

    public startScript(script: NarrativeEvent[]) {
        this.queue = [...script];
        this.currentEvent = null;
        this.isBlocked = false;
        this.waitTimer = 0;
    }

    public update(dt: number) {
        // Handle Wait Timer
        if (this.waitTimer > 0) {
            this.waitTimer -= dt;
            if (this.waitTimer <= 0) {
                this.isBlocked = false;
                this.next(); // Resume
            }
            return;
        }

        // If not blocked and no current event, fetch next
        if (!this.isBlocked && !this.currentEvent) {
            this.next();
        }
    }

    private async next() {
        if (this.queue.length === 0) return;

        this.currentEvent = this.queue.shift()!;
        console.log('[Narrative] Event:', this.currentEvent.type, this.currentEvent.payload);

        const handler = this.handlers.get(this.currentEvent.type);
        if (handler) {
            // If it's a blocking event (like WAIT or a complex animation), we set blocked
            // For WAIT, the handler sets it.
            // For others, let them decide? Or allow returning a Promise?
            // Simple generic block:
            // if (this.currentEvent.blocking) this.isBlocked = true; 

            // Execute
            await handler(this.currentEvent);
        }

        // Clear current unless blocked (Wait handler sets block)
        if (!this.isBlocked) {
            this.currentEvent = null;
            // Immediate next? Or wait next frame? 
            // Better to wait next update() to avoid stack depth
        }
    }

    public pause() {
        this.isBlocked = true;
    }

    public resume() {
        this.isBlocked = false;
        this.currentEvent = null;
    }
}
