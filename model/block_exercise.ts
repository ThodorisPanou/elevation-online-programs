interface BlockExercise {
    id: string,
    block?: Block,
    exercise: Exercise,
    sets?: number,
    reps?: string,
    kg?: string,
    rest_seconds?: number,
    notes?: string,
    track?: boolean,
    order_index: number
}