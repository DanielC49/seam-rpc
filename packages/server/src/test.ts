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

console.log(convert(z.object({
    test: z.object({
        a: z.string(),
        b: z.string(),
        c: z.string(),
        d: z.string(),
        e: z.string(),
        f: z.string(),
        ga: z.string(),
        wea: z.string(),
        waa: z.string(),
        wga: z.string(),
        weega: z.string(),
        wwa: z.string(),
        af: z.string(),
        wha: z.string(),
        ag: z.string(),
        wwea: z.string(),
        we3a: z.string(),
        wada: z.string(),
    })
})));