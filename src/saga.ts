import { Cmd, Program } from "@typescript-tea/core";

type Update<State, Action> = {
    readonly action: Action;
    readonly state: State;
};
type Input<State, Action> =
    | ({
          readonly type: "take";
      } & Update<State, Action>)
    | { readonly type: "getState"; readonly state: State }
    | undefined;
type InternalPseudoAction = NonNullable<Input<unknown, unknown>>["type"];
type Output<State, Action> = readonly [State, Cmd<Action>?];
export type InfiniteSaga<State, Action> = Generator<
    Output<State, Action> | InternalPseudoAction,
    never,
    Input<State, Action>
>;
export type FiniteSaga<State, Action> = Generator<
    Output<State, Action> | InternalPseudoAction,
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    undefined | void,
    Input<State, Action>
>;

type SagaRunner<State, Action> = Generator<
    Output<State, Action>,
    never,
    {
        readonly action: Action;
        readonly state: State;
    }
>;

function* createSagaRunner<State, Action>(
    initialState: State,
    saga: InfiniteSaga<State, Action>
): SagaRunner<State, Action> {
    let cmds: Array<NonNullable<Output<State, Action>[1]>> = [];
    let state = initialState;
    // No value can be given to .next at the first invocation.
    let output = saga.next().value;
    for (;;) {
        switch (output) {
            case "take": {
                // The saga requests an action. Get it from the program update.
                const update = yield [state, Cmd.batch(cmds)];
                const action = update.action;
                state = update.state;

                // The old commands were consumed by the yield.
                cmds = [];

                // Answer the request.
                output = saga.next({ type: output, state, action }).value;
                break;
            }

            case "getState": {
                // Answer the request.
                output = saga.next({ type: output, state }).value;
                break;
            }

            default: {
                // Update state and collect cmds.
                state = output[0];
                if (output[1]) {
                    cmds.push(output[1]);
                }

                // Nothing to answer with.
                output = saga.next().value;
                break;
            }
        }
    }
}

export type Api<State, Action> = {
    readonly takeAny: () => Generator<
        InternalPseudoAction,
        Update<State, Action>,
        Input<State, Action>
    >;
    readonly take: <T extends Action>(
        predicate: (action: Action) => action is T
    ) => Generator<
        InternalPseudoAction,
        Update<State, T>,
        Input<State, Action>
    >;
    readonly forever: (
        finiteSaga: () => FiniteSaga<State, Action>
    ) => InfiniteSaga<State, Action>;
    readonly getState: () => Generator<
        InternalPseudoAction,
        State,
        Input<State, Action>
    >;
    readonly parallel: (
        createSubSagas: ReadonlyArray<() => InfiniteSaga<State, Action>>
    ) => Generator<
        Output<State, Action> | InternalPseudoAction,
        never,
        Input<State, Action>
    >;
    readonly resumeAfterCmd: <Payload>(
        createCommand: (
            createAction: (payload: Payload) => {
                readonly tag: symbol;
                readonly payload: Payload;
            }
        ) => Cmd<Action>
    ) => Generator<
        Output<State, Action> | InternalPseudoAction,
        Payload,
        Input<State, Action>
    >;
};

// Convenient wrapper. Gives type safe handling of the pseudo actions. The check inside is not strictly needed, but useful for development.
function* typedYield<T extends InternalPseudoAction, State, Action>(
    internalPseudoAction: T
): Generator<
    InternalPseudoAction,
    Extract<Input<State, Action>, { readonly type: T }>,
    Input<State, Action>
> {
    const input = yield internalPseudoAction;
    if (input?.type !== internalPseudoAction) {
        throw new Error("yield should have returned a 'take'");
    }
    return input as Extract<Input<State, Action>, { readonly type: T }>;
}

function* takeAny<State, Action>(): Generator<
    InternalPseudoAction,
    Update<State, Action>,
    Input<State, Action>
> {
    for (;;) {
        return yield* typedYield("take");
    }
}

function* take<T extends Action, State, Action>(
    predicate: (action: Action) => action is T
): Generator<InternalPseudoAction, Update<State, T>, Input<State, Action>> {
    for (;;) {
        const input = yield* typedYield("take");
        if (predicate(input.action)) {
            // Just to satisfy the type checker. This could be a cast instead.
            return { action: input.action, state: input.state };
        }
    }
}

function* forever<State, Action>(
    finiteSaga: () => FiniteSaga<State, Action>
): InfiniteSaga<State, Action> {
    // Run the finite saga repeatedly.
    for (;;) {
        yield* finiteSaga();
    }
}

function* getState<State, Action>(): Generator<
    InternalPseudoAction,
    State,
    Input<State, Action>
> {
    return (yield* typedYield("getState")).state;
}

function* parallel<State, Action>(
    createSubSagas: ReadonlyArray<() => InfiniteSaga<State, Action>>
): Generator<
    Output<State, Action> | InternalPseudoAction,
    never,
    Input<State, Action>
> {
    const subSagaRunners = [];
    {
        const cmds = [];
        let state = yield* getState();
        for (const createSubSaga of createSubSagas) {
            const subSagaRunner = createSagaRunner(state, createSubSaga());
            subSagaRunners.push(subSagaRunner);

            const [newState, cmd] = subSagaRunner.next().value;
            state = newState;
            cmds.push(cmd);
        }
        yield [state, Cmd.batch(cmds)];
    }

    for (;;) {
        const cmds = [];
        let { state, action } = yield* takeAny<State, Action>();
        for (const subSagaRunner of subSagaRunners) {
            const [newState, cmd] = subSagaRunner.next({ state, action }).value;
            state = newState;
            cmds.push(cmd);
        }
        yield [state, Cmd.batch(cmds)];
    }
}

function* resumeAfterCmd<Payload, State, Action>(
    createCommand: (
        createAction: (payload: Payload) => {
            readonly tag: symbol;
            readonly payload: Payload;
        }
    ) => Cmd<Action>
): Generator<
    Output<State, Action> | InternalPseudoAction,
    Payload,
    Input<State, Action>
> {
    const tag = Symbol("createResume");
    const state = yield* getState();
    yield [state, createCommand((payload) => ({ tag, payload }))];
    return (yield* take(
        (
            action: unknown
        ): action is {
            readonly tag: symbol;
            readonly payload: Payload;
        } => action instanceof Object && "tag" in action && action?.tag === tag
    )).action.payload;
}

export function createSagaInitAndUpdate<Init, State, Action>({
    init,
    createSaga,
}: {
    readonly init: (initInput: Init) => State;
    /**
     * A saga must loop forever or throw, never return. That is type checked.
     * A saga must at some point yield* a Api.takeAny() or Api.take(...), or it
     * will crash with an infinite loop.
     */
    readonly createSaga: (
        api: Api<State, Action>,
        initInput: Init
    ) => InfiniteSaga<State, Action>;
}): Pick<Program<Init, State, Action, unknown>, "init" | "update"> {
    let sagaRunner: SagaRunner<State, Action>;

    return {
        init: (initInput) => {
            sagaRunner = createSagaRunner(
                init(initInput),
                createSaga(
                    {
                        takeAny,
                        take,
                        forever,
                        getState,
                        parallel,
                        resumeAfterCmd,
                    },
                    initInput
                )
            );

            // The saga might need to run at once, but update isn't called until the first action.
            // No argument to .next(). It is ignored on the first invocation, since generators don't start at a yield.
            return sagaRunner.next().value;
        },
        update: (action, state) => sagaRunner.next({ action, state }).value,
    };
}
