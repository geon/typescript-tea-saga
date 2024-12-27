import { expect, test, vi } from "vitest";
import { Program } from "@typescript-tea/core";
import { Api, createSagaInitAndUpdate, InfiniteSaga } from "./saga";
import * as NullEffectManager from "./test-utilities/null-effect-manager";

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

test("Create a saga that sets the state.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ takeAny }) {
                for (;;) {
                    yield [1];
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
                    expect(state).toEqual(1);
                    done();
                }),
            []
        );
    }));

test("Create a saga that takes an action before setting the state.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ takeAny }) {
                for (;;) {
                    yield* takeAny();
                    yield [1];
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
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(1);
                    done();
                }),
            []
        );
    }));

test("Create a saga that takes a specific action before setting the state.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ take }) {
                for (;;) {
                    yield* take((action: unknown) => action === "simon says");
                    yield [1];
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
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("simon says");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(1);
                    done();
                }),
            []
        );
    }));

test("Create a repeating finite saga.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ forever, takeAny }) {
                return yield* forever(function* () {
                    yield* takeAny();
                });
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

test("Create a counting saga.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ forever, takeAny }) {
                return yield* forever(function* () {
                    const { state } = yield* takeAny();
                    yield [state + 1];
                });
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
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(1);
                    dispatch("");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(2);
                    done();
                }),
            []
        );
    }));

test("Create a incrementing and decrementing saga.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ forever, take }) {
                return yield* forever(function* () {
                    const { state, action } = yield* take(
                        (action) =>
                            action === "increment" || action == "decrement"
                    );
                    const change = {
                        increment: 1,
                        decrement: -1,
                    };
                    yield [state + change[action]];
                });
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
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("increment");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(1);
                    dispatch("decrement");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(0);
                    done();
                }),
            []
        );
    }));

test("Create an ok/cancel saga.", async () => {
    type Init = undefined;
    type State = number;
    type Action = string;

    function* createSaga({ forever, take }: Api<State, Action>) {
        return yield* forever(function* () {
            const { state } = yield* take(
                (action) => action === "open increment dialog"
            );

            yield [123];

            const { action } = yield* take(
                (action): action is "ok" | "cancel" =>
                    action === "ok" || action === "cancel"
            );
            if (action === "cancel") {
                yield [state];
                return;
            }

            yield [state + 1];
        });
    }

    await new Promise<void>((done) => {
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga,
        });

        Program.run(
            {
                ...sagaInitAndUpdate,
                view: (props) => props,
            },
            undefined,
            vi
                .fn<Render<State, Action>>()
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("open increment dialog");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(123);
                    dispatch("cancel");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(0);
                    done();
                }),
            []
        );
    });

    await new Promise<void>((done) => {
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga,
        });

        Program.run(
            {
                ...sagaInitAndUpdate,
                view: (props) => props,
            },
            undefined,
            vi
                .fn<Render<State, Action>>()
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("open increment dialog");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(123);
                    dispatch("ok");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(1);
                    done();
                }),
            []
        );
    });
});

test("Create a saga with getState.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ forever, getState, takeAny }) {
                return yield* forever(function* () {
                    const state = yield* getState();
                    yield [state + 1];
                    yield* takeAny();
                });
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
                    expect(state).toEqual(1);
                    done();
                }),
            []
        );
    }));

test("Create a saga with parallel sub-sagas.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = {
            readonly a: number;
            readonly b: number;
        };
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => ({ a: 0, b: 0 }),
            createSaga: function* ({ forever, parallel, take }) {
                return yield* parallel([
                    function* () {
                        return yield* forever(function* () {
                            const { state } = yield* take(
                                (action) => action === "a"
                            );
                            yield [{ ...state, a: state.a + 1 }];
                        });
                    },
                    function* () {
                        return yield* forever(function* () {
                            const { state } = yield* take(
                                (action) => action === "b"
                            );
                            yield [{ ...state, b: state.b + 1 }];
                        });
                    },
                ]);
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
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual({ a: 0, b: 0 });
                    dispatch("a");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual({ a: 1, b: 0 });
                    dispatch("b");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual({ a: 1, b: 1 });
                    dispatch("a");
                })
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual({ a: 2, b: 1 });
                    dispatch("b");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual({ a: 2, b: 2 });
                    done();
                }),
            []
        );
    }));

test("Create a saga issuing cmds in init.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ getState, forever, take }) {
                yield [yield* getState(), NullEffectManager.echo("from cmd")];
                yield [yield* getState(), NullEffectManager.echo("from cmd")];
                return yield* forever(function* () {
                    const { state } = yield* take(
                        (action) => action === "from cmd"
                    );
                    yield [state + 1];
                });
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
                    expect(state).toEqual(1);
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(2);
                    done();
                }),
            [NullEffectManager.createEffectManager<Action>() as any]
        );
    }));

test("Create a saga issuing cmds after action.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;
        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ getState, forever, take }) {
                yield* take((action) => action === "from dispatch");
                yield [yield* getState(), NullEffectManager.echo("from cmd")];
                yield [yield* getState(), NullEffectManager.echo("from cmd")];
                return yield* forever(function* () {
                    const { state } = yield* take(
                        (action) => action === "from cmd"
                    );
                    yield [state + 1];
                });
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
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("from dispatch");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(1);
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(2);
                    done();
                }),
            [NullEffectManager.createEffectManager<Action>() as any]
        );
    }));

test("Create a saga issuing cmds in parallel in init.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;

        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ getState, parallel, forever, take }) {
                function* commandIssuer(): InfiniteSaga<State, Action> {
                    yield [
                        yield* getState(),
                        NullEffectManager.echo("from cmd"),
                    ];
                    return yield* forever(function* () {
                        yield* take((action) => action === "");
                    });
                }

                return yield* parallel([
                    commandIssuer,
                    commandIssuer,
                    function* () {
                        return yield* forever(function* () {
                            const { state } = yield* take(
                                (action) => action === "from cmd"
                            );
                            yield [state + 1];
                        });
                    },
                ]);
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
                    expect(state).toEqual(1);
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(2);
                    done();
                }),
            [NullEffectManager.createEffectManager<Action>() as any]
        );
    }));

test("Create a saga issuing cmds in parallel after action.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;

        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ getState, parallel, forever, take }) {
                function* commandIssuer() {
                    return yield* forever(function* () {
                        yield* take((action) => action === "from dispatch");
                        yield [
                            yield* getState(),
                            NullEffectManager.echo("from cmd"),
                        ];
                    });
                }

                return yield* parallel([
                    commandIssuer,
                    commandIssuer,
                    function* () {
                        return yield* forever(function* () {
                            const { state } = yield* take(
                                (action) => action === "from cmd"
                            );
                            yield [state + 1];
                        });
                    },
                ]);
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
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("from dispatch");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(1);
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(2);
                    done();
                }),
            [NullEffectManager.createEffectManager<Action>() as any]
        );
    }));

test("Create a saga issuing a cmd and resuming on its response.", () =>
    new Promise<void>((done) => {
        type Init = undefined;
        type State = number;
        type Action = string;

        type FakeNetworkResponse = {
            apiVersion: string;
            fakeData: { magicNumber: number };
        };

        const sagaInitAndUpdate = createSagaInitAndUpdate<Init, State, Action>({
            init: () => 0,
            createSaga: function* ({ forever, take, resumeAfterCmd }) {
                return yield* forever(function* () {
                    yield* take(
                        (action) => action === "do fake network request"
                    );

                    const response = yield* resumeAfterCmd<FakeNetworkResponse>(
                        (createAction) =>
                            NullEffectManager.echo(
                                createAction({
                                    apiVersion: "1.2.3",
                                    fakeData: { magicNumber: 1 },
                                })
                            )
                    );

                    yield [response.fakeData.magicNumber];
                });
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
                .mockImplementationOnce(({ state, dispatch }): void => {
                    expect(state).toEqual(0);
                    dispatch("do fake network request");
                })
                .mockImplementationOnce(({ state }): void => {
                    expect(state).toEqual(1);
                    done();
                }),
            [NullEffectManager.createEffectManager<Action>() as any]
        );
    }));
