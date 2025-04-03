type BoundType = 'inclusive' | 'exclusive';

interface Bound {
	id: string;
	type: BoundType;
}

export type { BoundType, Bound };
