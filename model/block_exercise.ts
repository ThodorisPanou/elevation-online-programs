interface BlockExercise {
    id: string,
    block?: Block,
    exercise: Exercise,
    sets?: number,
    reps?: string,
    kg?: string,
    rest_seconds?: number,
    notes?: string,
    order_index: number
}