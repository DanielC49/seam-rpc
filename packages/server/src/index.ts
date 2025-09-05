import { Express, Request, Response, Router } from "express";

export interface RouterDefinition {
    [funcName: string]: (...args: any[]) => Promise<any>;
};

export function createRouter(app: Express, path: string, routerDefinition: RouterDefinition): void {
    const router = Router();

    router.post("/:funcName", async (req: Request, res: Response) => {
        if (!(req.params.funcName in routerDefinition))
            return res.sendStatus(404);

        try {
            const result = await routerDefinition[req.params.funcName](...Object.values(req.body));
            res.send(JSON.stringify({ result }));
        } catch (error) {
            res.status(400).send({ error });
        }
    });

    app.use(path, router);
}