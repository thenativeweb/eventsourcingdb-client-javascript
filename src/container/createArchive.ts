interface ContentToCopy {
	content: string | Buffer;
	target: string;
	mode?: number;
}

interface Field {
	offset: number;
	length: number;
}

// A tar archive consists of blocks of 512 bytes. Each file has a header block,
// followed by its content, padded to whole blocks, and two empty blocks end
// the archive. The fields of a header that are not set stay zero.
const blockSize = 512;
const endBlockCount = 2;
const nameField: Field = { offset: 0, length: 100 };
const modeField: Field = { offset: 100, length: 8 };
const sizeField: Field = { offset: 124, length: 12 };
const modificationTimeField: Field = { offset: 136, length: 12 };
const checksumField: Field = { offset: 148, length: 8 };
const typeField: Field = { offset: 156, length: 1 };
const magicField: Field = { offset: 257, length: 8 };
const regularFile = '0';
const ustarMagic = 'ustar\u000000';
const octal = 8;
const defaultMode = 0o644;
const millisecondsPerSecond = 1000;
const leadingSlashes = /^\/+/u;

const writeField = (header: Buffer, { offset, length }: Field, value: string): void => {
	header.write(value, offset, length, 'utf8');
};

// A number takes up all but the last byte of its field, in octal, and the
// last byte ends it.
const writeNumber = (header: Buffer, field: Field, value: number): void => {
	writeField(header, field, `${value.toString(octal).padStart(field.length - 1, '0')}\u0000`);
};

const createEntry = ({ content, target, mode = defaultMode }: ContentToCopy): Buffer[] => {
	const data = Buffer.from(content);
	const header = Buffer.alloc(blockSize);

	writeField(header, nameField, target.replace(leadingSlashes, ''));
	writeNumber(header, modeField, mode);
	writeNumber(header, sizeField, data.length);
	writeNumber(header, modificationTimeField, Math.floor(Date.now() / millisecondsPerSecond));
	writeField(header, typeField, regularFile);
	writeField(header, magicField, ustarMagic);

	// The checksum adds up the bytes of the header, counting its own field as
	// spaces, and takes up all but the last two bytes of its field.
	writeField(header, checksumField, ' '.repeat(checksumField.length));
	const checksum = header.reduce((sum, byte) => sum + byte, 0);
	writeNumber(header, { ...checksumField, length: checksumField.length - 1 }, checksum);

	const padding = Buffer.alloc((blockSize - (data.length % blockSize)) % blockSize);

	return [header, data, padding];
};

// Packs the contents into a tar archive, which is what Docker expects for
// copying files into a container.
const createArchive = (contents: ContentToCopy[]): Buffer =>
	Buffer.concat([...contents.flatMap(createEntry), Buffer.alloc(endBlockCount * blockSize)]);

export type { ContentToCopy };
export { createArchive };
