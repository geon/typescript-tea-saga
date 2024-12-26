import { expect, test, vi } from "vitest";
import { Program } from "@typescript-tea/core";
import { createSagaInitAndUpdate } from "./saga";

// The type of the Program.run render function.
type Render<State, Action> = (
    props: Parameters<Program<unknown, State, Action, unknown>["view"]>[0]
) => void;

test("Create a saga with an initial state.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ takeAny }) {
                // Simplest possible valid saga.
                for (;;) {
                    yield* takeAny();
                }
            },
        });

        Program.run(
            {
                ...sagaInitAndUpdate,
                view: (props) => props,
            },
            undefined,
            vi
                .fn<Render<State, Action>>()
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(0);
                    done();
                }),
            []
        );
    }));
