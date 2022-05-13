import { TransformStream } from 'stream/web';

const parseLine = function (): TransformStream {
  return new TransformStream({
    transform (chunk, controller): void {
      const event = JSON.parse(chunk);

      controller.enqueue(event);
    }
  });
};

export { parseLine };
