import { expect, test, vi } from "vitest";
import { Program } from "@typescript-tea/core";
import { Api, createSagaInitAndUpdate, FiniteSaga } from "./saga";

// The type of the Program.run render function.
type Render<State, Action> = (
    props: Parameters<Program<unknown, State, Action, unknown>["view"]>[0]
) => void;

test("Incrementing with restart.", () =>
    new Promise<void>((done) => {
        type Init = void;
        type State = number;
        type Action = "increment" | "restart";

        const { init, update } = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* (api) {
                return yield* api.forever(function* () {
                    yield [0];

                    for (;;) {
                        const { action, state } = yield* api.take(
                            (action) =>
                                action === "increment" || action === "restart"
                        );
                        if (action === "restart") {
                            return;
                        }

                        yield [state + 1];
                    }
                });
            },
        });

        Program.run(
            {
                init,
                update,
                view: (props) => props,
            },
            undefined,
            vi
                .fn<Render<State, Action>>()
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("increment");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(1);
                    dispatch("increment");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(2);
                    dispatch("restart");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("increment");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(1);
                    done();
                }),
            []
        );
    }));

test("Incrementing in dialog.", () =>
    new Promise<void>((done) => {
        type Init = void;
        type State = {
            readonly counter: number;
            readonly dialog: number | undefined;
        };
        type Action =
            | "openIncrementDialog"
            | "increment"
            | "closeIncrementDialogOk"
            | "closeIncrementDialogCancel";

        const { init, update } = createSagaInitAndUpdate<Init, State, Action>({
            init: () => ({ counter: 0, dialog: undefined }),
            createSaga: function* (api) {
                return yield* api.forever(function* () {
                    yield* api.take(
                        (action) => action === "openIncrementDialog"
                    );

                    const dialogResult = yield* openIncrementDialog(api);

                    if (dialogResult.type === "cancel") {
                        return;
                    }

                    const state = yield* api.getState();
                    yield [
                        {
                            ...state,
                            counter: state.counter + dialogResult.amount,
                        },
                    ];
                });
            },
        });

        function* openIncrementDialog(api: Api<State, Action>): FiniteSaga<
            State,
            Action,
            | {
                  readonly type: "cancel";
              }
            | {
                  readonly type: "ok";
                  readonly amount: number;
              }
        > {
            // Initialize the dialog state.
            yield [{ ...(yield* api.getState()), dialog: 0 }];

            for (;;) {
                const { action } = yield* api.take(
                    (action) =>
                        action === "increment" ||
                        action === "closeIncrementDialogOk" ||
                        action === "closeIncrementDialogCancel"
                );

                if (action === "increment") {
                    // Increment the dialog state.
                    const state = yield* api.getState();
                    if (state.dialog === undefined) {
                        throw new Error("Dialog state not set.");
                    }
                    yield [{ ...state, dialog: state.dialog + 1 }];
                    continue;
                }

                // Remove the dialog state.
                const state = yield* api.getState();
                yield [{ ...state, dialog: undefined }];

                // Return the result.
                switch (action) {
                    case "closeIncrementDialogOk": {
                        if (state.dialog === undefined) {
                            throw new Error("Dialog state not set.");
                        }
                        return { type: "ok", amount: state.dialog };
                    }

                    case "closeIncrementDialogCancel": {
                        return { type: "cancel" };
                    }

                    default: {
                        return action satisfies never;
                    }
                }
            }
        }

        Program.run(
            {
                init,
                update,
                view: (props) => props,
            },
            undefined,
            vi
                .fn<Render<State, Action>>()
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual({ counter: 0, dialog: undefined });
                    dispatch("increment");
                    dispatch("increment");
                    dispatch("openIncrementDialog");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual({ counter: 0, dialog: 0 });
                    dispatch("increment");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual({ counter: 0, dialog: 1 });
                    dispatch("increment");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual({ counter: 0, dialog: 2 });
                    dispatch("closeIncrementDialogOk");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual({ counter: 2, dialog: undefined });
                    done();
                }),
            []
        );
    }));
