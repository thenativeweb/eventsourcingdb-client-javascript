// An answer of the v2 API, or an item of one of its streams, together with its
// text, so that a value can be taken from it exactly as the server sent it.
interface V2Item {
	type: string;
	data: unknown;
	text: string;
}

export type { V2Item };
