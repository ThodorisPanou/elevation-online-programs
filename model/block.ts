interface Block{
    id: string
    day?: ProgramDay,
    block_exercises?: Array<BlockExercise>,
    name: string
    order_index: number
}