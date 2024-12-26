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
