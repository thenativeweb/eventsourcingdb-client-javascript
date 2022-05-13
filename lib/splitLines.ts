import { TransformStream } from 'stream/web';

const splitLines = function (): TransformStream {
  let buffer = '';

  return new TransformStream({
    transform (chunk, controller): void {
      buffer += chunk;

      const lines = buffer.split('\n');

      for (let i = 0; i < lines.length - 1; i++) {
        controller.enqueue(lines[i]);
      }

      buffer = lines.at(-1) ?? '';
    },

    flush (controller): void {
      if (buffer.length > 0) {
        controller.enqueue(buffer);
      }
    }
  });
};

export { splitLines };
