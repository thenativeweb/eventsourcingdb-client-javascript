type BoundType = 'inclusive' | 'exclusive';

interface Bound {
	id: string;
	type: BoundType;
}

export type { Bound, BoundType };
