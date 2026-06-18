import z from "zod";

export const outputUser = z.object({
    id: z.string(),
    name: z.string(),
    age: z.int(),
    createdAt: z.date(),
});