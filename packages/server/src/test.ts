import { zodToTs, createAuxiliaryTypeStore, printNode } from "zod-to-ts";
import * as z from "zod";
import ts from "typescript";

export function convert(schema: z.ZodTypeAny): string {
    const store = createAuxiliaryTypeStore();

    const { node } = zodToTs(schema, {
        auxiliaryTypeStore: store,
    });

    const typeAlias = ts.factory.createTypeAliasDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createIdentifier("GeneratedType"),
        undefined,
        node
    );

    const file = ts.createSourceFile(
        "types.ts",
        "",
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.TS
    );

    const printer = ts.createPrinter({
        newLine: ts.NewLineKind.LineFeed,
        removeComments: false,
    });

    return printer.printNode(
        ts.EmitHint.Unspecified,
        typeAlias,
        file
    );
}

function convert2(schema: z.ZodType): string {
    const store = createAuxiliaryTypeStore();
    const { node } = zodToTs(schema, { auxiliaryTypeStore: store });
    return printNode(node);
}

console.log(convert2(
    z.object({
        user: z.object({
            email: z.string(),
            id: z.string(),
            createdAt: z.date(),
            firstName: z.string(),
            lastName: z.string(),
            trackingStartDate: z.string(),
            trackingWorkItemId: z.string(),
        }),
        roles: z.object({
            id: z.string(),
            name: z.string(),
            createdAt: z.date(),
            permissions: z.number().array(),
            projectId: z.string(),
        }),
        workItems: z.object({
            id: z.string(),
            createdAt: z.date(),
            date: z.date(),
            link: z.string(),
            title: z.string(),
            description: z.string(),
            projectId: z.string(),
            authorId: z.string(),
            durationMethod: z.string(),
            startTime: z.number(),
            endTime: z.number(),
            duration: z.number(),
            labels: z.string(),
            updatedAt: z.string(),
            projectMemberId: z.string(),
        })
    })
));