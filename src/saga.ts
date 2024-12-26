import { Cmd, Program } from "@typescript-tea/core";

type Update<State, Action> = {
    readonly action: Action;
    readonly state: State;
};
type Input<State, Action> =
    | ({
          readonly type: "take";
      } & Update<State, Action>)
    | undefined;
type InternalPseudoAction = NonNullable<Input<unknown, unknown>>["type"];
type Output<State, Action> = readonly [State, Cmd<Action>?];
type InfiniteSaga<State, Action> = Generator<
    Output<State, Action> | InternalPseudoAction,
    never,
    Input<State, Action>
>;

export type Api<State, Action> = {
    readonly takeAny: () => Generator<
        InternalPseudoAction,
        Update<State, Action>,
        Input<State, Action>
    >;
};

export function createSagaInitAndUpdate<Init, State, Action>({
    init,
}: {
    readonly init: (init: Init) => State;
    /**
     * A saga must loop forever or throw, never return. That is type checked.
     * A saga must at some point yield* a Api.takeAny() or Api.take(...), or it
     * will crash with an infinite loop.
     */
    readonly createSaga: (
        api: Api<State, Action>
    ) => InfiniteSaga<State, Action>;
}): Pick<Program<Init, State, Action, unknown>, "init" | "update"> {
    return {
        init: (initInput) => [init(initInput)],
        update: (_action, state) => [state],
    };
}
