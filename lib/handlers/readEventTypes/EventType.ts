import {isObject} from "../../util/isObject";

interface EventType {
    eventType: string;
    isPhantom: boolean;
    schema?: string;
}

const isEventType = (message: unknown): message is { payload: EventType } => {
    if (!isObject(message) || message.type !== 'eventType') {
        return false;
    }

    return true;
}

export {isEventType};
export type {EventType};