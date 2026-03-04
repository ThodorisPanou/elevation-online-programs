interface ProgramDay{
    id: string,
    program?: Program,
    blocks?: Array<Block>,
    name: string,
    order_index: number,
    created_at?: Date
}