/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    addEmbeddingModelUsage,
    EmbeddingModel,
    EmbeddingModelUsage
} from '../embeddings/index.ts'
import { chunkArray } from '../utils/chunk-array.ts'

export async function embed<T = string>({
    model,
    value,
    signal,
    headers
}: {
    model: EmbeddingModel<T>
    value: T | T[]
    signal?: AbortSignal
    headers?: Record<string, string>
}): Promise<EmbedResult<T>> {
    if (
        (model.batchSize != null &&
            Array.isArray(value) &&
            value.length < model.batchSize) ||
        (Array.isArray(value) && value.length < 20) ||
        !Array.isArray(value)
    ) {
        const response = await model.doEmbed({
            values: Array.isArray(value) ? value : [value],
            signal,
            headers
        })

        return {
            embedding: Array.isArray(value)
                ? (response.embeddings as number[][] as any)
                : (response.embeddings[0] as number[] as any),
            value,
            usage: response.usage ?? {
                tokens: NaN
            }
        }
    }

    return await chunkArray(value, (model.batchSize ?? 21) - 1).reduce(
        async (acc, chunk) => {
            const result = await acc
            const response = await model.doEmbed({
                values: chunk,
                signal,
                headers
            })
            return {
                embedding: result.embedding.concat(response.embeddings),
                value,
                usage: addEmbeddingModelUsage(result.usage, response.usage)
            } as EmbedResult<T>
        },
        Promise.resolve({
            embedding: [] as number[][],
            value,
            usage: {
                tokens: NaN
            }
        } as EmbedResult<T>)
    )
}

export interface EmbedResult<T> {
    readonly value: T | T[]

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    readonly embedding: this['value'] extends (infer U)[]
        ? number[][]
        : number[]

    readonly usage: EmbeddingModelUsage
}
